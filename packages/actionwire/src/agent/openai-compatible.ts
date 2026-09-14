import { createAliasTable } from '~/agent/alias';
import type { AliasTable } from '~/agent/alias';
import { AgentError } from '~/core';
import type { AgentAdapter, AgentTurn, Json, Message, ToolCall } from '~/core';

export function openAICompatible(options: { endpoint: string }): AgentAdapter {
  const aliases = createAliasTable();
  return {
    async generate(input): Promise<AgentTurn> {
      const names = new Map(input.tools.map((tool) => [aliases.aliasFor(tool), tool.id]));
      let response: Response;
      try {
        response = await fetch(options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: input.messages.map((message) => toProviderMessage(message, aliases)),
            tools: input.tools.map((tool) => ({
              type: 'function',
              function: {
                name: aliases.aliasFor(tool),
                description:
                  tool.title === undefined
                    ? tool.description
                    : `${tool.title}. ${tool.description}`,
                parameters: tool.inputSchema,
              },
            })),
          }),
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new AgentError('ABORTED', 'The model request was aborted.', { cause: error });
        }
        throw new AgentError('MODEL_ERROR', 'The model request failed.', { cause: error });
      }
      if (!response.ok) {
        throw new AgentError('MODEL_ERROR', 'The model request failed.');
      }
      let payload: unknown;
      try {
        payload = JSON.parse(await response.text());
      } catch (error) {
        throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.', {
          cause: error,
        });
      }
      return parseTurn(payload, names);
    },
  };
}

function toProviderMessage(message: Message, aliases: AliasTable): Record<string, unknown> {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content, tool_call_id: message.callId };
  }
  if (message.role === 'assistant') {
    const payload: Record<string, unknown> = { role: 'assistant', content: message.content };
    if (message.toolCalls !== undefined && message.toolCalls.length > 0) {
      payload['tool_calls'] = message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: {
          name: aliases.aliasOf(call.toolId),
          arguments: JSON.stringify(call.arguments),
        },
      }));
    }
    return payload;
  }
  return { role: message.role, content: message.content };
}

function parseTurn(payload: unknown, names: Map<string, string>): AgentTurn {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  const choices = Reflect.get(payload, 'choices');
  if (!Array.isArray(choices) || choices.length === 0) {
    const error = Reflect.get(payload, 'error');
    if (typeof error === 'object' && error !== null) {
      const message = Reflect.get(error, 'message');
      if (typeof message === 'string' && message.trim() !== '') {
        throw new AgentError('MODEL_ERROR', message);
      }
    }
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  const choice = choices[0];
  const message =
    typeof choice === 'object' && choice !== null ? Reflect.get(choice, 'message') : undefined;
  if (typeof message !== 'object' || message === null) {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  const content = Reflect.get(message, 'content');
  const text = normalizeAssistantContent(content);
  const rawCalls = Reflect.get(message, 'tool_calls');
  if (rawCalls === undefined) return { text, toolCalls: [] };
  if (!Array.isArray(rawCalls)) {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  return { text, toolCalls: rawCalls.map((entry) => parseCall(entry, names)) };
}

function parseCall(entry: unknown, names: Map<string, string>): ToolCall {
  if (typeof entry !== 'object' || entry === null) {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  const id = Reflect.get(entry, 'id');
  const fn = Reflect.get(entry, 'function');
  if (typeof id !== 'string' || id.length === 0 || typeof fn !== 'object' || fn === null) {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  const name = Reflect.get(fn, 'name');
  const rawArguments = Reflect.get(fn, 'arguments');
  if (typeof name !== 'string') {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  const toolId = names.get(name);
  if (toolId === undefined) {
    throw new AgentError('MODEL_ERROR', 'The model requested an unknown tool.');
  }
  return { id, toolId, arguments: parseArguments(rawArguments) };
}

function normalizeAssistantContent(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const entry of content) {
      if (typeof entry !== 'object' || entry === null) continue;
      const type = Reflect.get(entry, 'type');
      if (type !== 'text') continue;
      const text = Reflect.get(entry, 'text');
      if (typeof text === 'string') parts.push(text);
    }
    return parts.join('\n');
  }
  throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
}

function parseArguments(raw: unknown): Record<string, Json> {
  if (raw === undefined || raw === null || raw === '') {
    return {};
  }
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch (error) {
      throw new AgentError('MODEL_ERROR', 'Tool arguments must be valid JSON.', { cause: error });
    }
  }
  if (!isJsonRecord(value)) {
    throw new AgentError('MODEL_ERROR', 'Tool arguments must be a JSON object.');
  }
  return value;
}

function isJsonRecord(value: unknown): value is Record<string, Json> {
  return isJson(value) && value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value).every(isJson);
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
}
