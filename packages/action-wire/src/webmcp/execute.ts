import { Validator } from '@cfworker/json-schema';

import { AgentError } from '~/core';
import type { ErrorCode, Json, ToolCall, ToolResult } from '~/core';
import { DRAFT_2020, DRAFT_7 } from '~/core/meta-schemas';
import { getNativeContext } from '~/webmcp/native';
import type { NormalizedNativeTool } from '~/webmcp/normalize';

// ponytail: 8192-character result ceiling. Raise it behind a source option if a host needs larger tool results.
const MAX_RESULT_TEXT = 8192;

export async function executeNativeTool(input: {
  call: ToolCall;
  revision: number;
  signal?: AbortSignal | undefined;
  disposed: boolean;
  currentRevision: number;
  handles: ReadonlyMap<string, NormalizedNativeTool>;
}): Promise<ToolResult> {
  const { call } = input;
  if (input.disposed || input.signal?.aborted) {
    return fail(call.id, 'ABORTED', 'The tool call was aborted.');
  }
  if (input.revision !== input.currentRevision) {
    return fail(call.id, 'STALE_TOOLS', 'The tool list changed. Discover tools again.');
  }
  const handle = input.handles.get(call.toolId);
  if (handle === undefined) {
    return fail(call.id, 'TOOL_UNAVAILABLE', 'This tool is not available.');
  }
  if (!validArguments(handle.definition.inputSchema, call.arguments)) {
    return fail(call.id, 'INVALID_ARGUMENTS', 'The tool arguments do not match the input schema.');
  }
  let context;
  try {
    context = getNativeContext();
  } catch (error) {
    if (error instanceof AgentError) return fail(call.id, error.code, error.message);
    return fail(call.id, 'EXECUTION_FAILED', 'Tool execution failed.');
  }
  const payload =
    handle.encoding === 'json-string' ? JSON.stringify(call.arguments) : call.arguments;
  let raw: unknown;
  try {
    raw =
      input.signal === undefined
        ? await context.executeTool(handle.native, payload)
        : await context.executeTool(handle.native, payload, { signal: input.signal });
  } catch (error) {
    if (input.signal?.aborted || isAbortError(error)) {
      return fail(call.id, 'ABORTED', 'The tool call was aborted.');
    }
    return fail(
      call.id,
      'EXECUTION_FAILED',
      error instanceof Error ? error.message : 'Tool execution failed.',
    );
  }
  return normalizeResult(call.id, raw);
}

function validArguments(schema: Record<string, Json>, data: Record<string, Json>): boolean {
  const dialect = schema['$schema'];
  if (dialect !== undefined && dialect !== DRAFT_7 && dialect !== DRAFT_2020) return false;
  const validator = new Validator(schema, dialect === DRAFT_7 ? '7' : '2020-12');
  return validator.validate(data).valid;
}

function normalizeResult(callId: string, raw: unknown): ToolResult {
  if (raw === null) {
    return { callId, ok: true, text: 'The tool completed with no result.' };
  }
  if (typeof raw === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail(callId, 'EXECUTION_FAILED', 'The tool result is not valid JSON.');
    }
    return fromJson(callId, parsed);
  }
  return fromJson(callId, raw);
}

function fromJson(callId: string, value: unknown): ToolResult {
  if (!isJson(value)) {
    return fail(callId, 'EXECUTION_FAILED', 'The tool result is not valid JSON.');
  }
  const text = boundText(summarize(value));
  const encoded = JSON.stringify(value);
  const result: ToolResult = { callId, ok: true, text };
  if (encoded.length <= MAX_RESULT_TEXT) result.data = value;
  return result;
}

function summarize(value: Json): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const text = value['text'];
    if (typeof text === 'string') return text;
  }
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function boundText(text: string): string {
  return text.length <= MAX_RESULT_TEXT ? text : text.slice(0, MAX_RESULT_TEXT);
}

function fail(callId: string, code: ErrorCode, text: string): ToolResult {
  return { callId, ok: false, text, code };
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
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
