import type { AliasTable } from '~/agent/alias';
import { AgentError } from '~/core';
import type { AgentTurn, Json, Message, ToolCall } from '~/core';
import { isJson } from '~/core/json';

const INVALID = 'The model response is not valid JSON.';

export function toProviderMessage(message: Message, aliases: AliasTable): Record<string, unknown> {
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

export function parseTurn(payload: unknown, names: Map<string, string>): AgentTurn {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new AgentError('MODEL_ERROR', INVALID);
  }
  const choices = Reflect.get(payload, 'choices');
  if (!Array.isArray(choices) || choices.length === 0) {
    throw upstreamError(Reflect.get(payload, 'error'));
  }
  const choice = choices[0];
  const message =
    typeof choice === 'object' && choice !== null ? Reflect.get(choice, 'message') : undefined;
  if (typeof message !== 'object' || message === null) {
    throw new AgentError('MODEL_ERROR', INVALID);
  }
  const text = normalizeAssistantContent(Reflect.get(message, 'content'));
  const rawCalls = Reflect.get(message, 'tool_calls');
  if (rawCalls === undefined) return { text, toolCalls: [] };
  if (!Array.isArray(rawCalls)) throw new AgentError('MODEL_ERROR', INVALID);
  return { text, toolCalls: rawCalls.map((entry) => parseCall(entry, names)) };
}

function upstreamError(error: unknown): AgentError {
  if (typeof error === 'object' && error !== null) {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string' && message.trim() !== '') {
      return new AgentError('MODEL_ERROR', message);
    }
  }
  return new AgentError('MODEL_ERROR', INVALID);
}

function parseCall(entry: unknown, names: Map<string, string>): ToolCall {
  if (typeof entry !== 'object' || entry === null) {
    throw new AgentError('MODEL_ERROR', INVALID);
  }
  const id = Reflect.get(entry, 'id');
  const fn = Reflect.get(entry, 'function');
  if (typeof id !== 'string' || id.length === 0 || typeof fn !== 'object' || fn === null) {
    throw new AgentError('MODEL_ERROR', INVALID);
  }
  const name = Reflect.get(fn, 'name');
  if (typeof name !== 'string') throw new AgentError('MODEL_ERROR', INVALID);
  const toolId = names.get(name);
  if (toolId === undefined) {
    throw new AgentError('MODEL_ERROR', 'The model requested an unknown tool.');
  }
  return { id, toolId, arguments: parseArguments(Reflect.get(fn, 'arguments')) };
}

function normalizeAssistantContent(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) throw new AgentError('MODEL_ERROR', INVALID);
  const parts: string[] = [];
  for (const entry of content) {
    if (typeof entry !== 'object' || entry === null) continue;
    if (Reflect.get(entry, 'type') !== 'text') continue;
    const text = Reflect.get(entry, 'text');
    if (typeof text === 'string') parts.push(text);
  }
  return parts.join('\n');
}

function parseArguments(raw: unknown): Record<string, Json> {
  if (raw === undefined || raw === null || raw === '') return {};
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch (error) {
      throw new AgentError('MODEL_ERROR', 'Tool arguments must be valid JSON.', { cause: error });
    }
  }
  if (!isJson(value) || value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentError('MODEL_ERROR', 'Tool arguments must be a JSON object.');
  }
  return value;
}
