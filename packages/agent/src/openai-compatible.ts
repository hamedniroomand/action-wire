import { AgentError } from '@webmcp-agent/core';
import type {
  AgentAdapter,
  AgentTurn,
  Json,
  Message,
  ToolCall,
  ToolDefinition,
} from '@webmcp-agent/core';

const SAFE_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

export function openAICompatible(options: { endpoint: string }): AgentAdapter {
  return {
    async generate(input): Promise<AgentTurn> {
      const names = new Map<string, string>();
      for (const tool of input.tools) {
        names.set(toProviderName(tool), tool.id);
      }
      let response: Response;
      try {
        response = await fetch(options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: input.messages.map((message) => toProviderMessage(message, input.tools)),
            tools: input.tools.map((tool) => ({
              type: 'function',
              function: {
                name: toProviderName(tool),
                description: tool.description,
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

function toProviderName(tool: ToolDefinition): string {
  return SAFE_NAME.test(tool.name) ? tool.name : encodeToolId(tool.id);
}

function encodeToolId(id: string): string {
  const bytes = new TextEncoder().encode(id);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `t_${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}

function toProviderMessage(
  message: Message,
  tools: readonly ToolDefinition[],
): Record<string, unknown> {
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
          name: providerNameFor(call.toolId, tools),
          arguments: JSON.stringify(call.arguments),
        },
      }));
    }
    return payload;
  }
  return { role: message.role, content: message.content };
}

function providerNameFor(toolId: string, tools: readonly ToolDefinition[]): string {
  const tool = tools.find((entry) => entry.id === toolId);
  return tool === undefined ? encodeToolId(toolId) : toProviderName(tool);
}

function parseTurn(payload: unknown, names: Map<string, string>): AgentTurn {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  const choices = Reflect.get(payload, 'choices');
  const choice = Array.isArray(choices) ? choices[0] : undefined;
  const message =
    typeof choice === 'object' && choice !== null ? Reflect.get(choice, 'message') : undefined;
  if (typeof message !== 'object' || message === null) {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
  const content = Reflect.get(message, 'content');
  const text = content === null || content === undefined ? '' : content;
  if (typeof text !== 'string') {
    throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.');
  }
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

function parseArguments(raw: unknown): Record<string, Json> {
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
