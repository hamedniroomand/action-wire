import { AgentError } from '~/core';
import type { Json, ToolCall, ToolResult } from '~/core';
import { validateToolArguments } from '~/core/arguments';
import { failResult, isAbortError } from '~/core/errors';
import { isJson } from '~/core/json';
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
    return failResult(call.id, 'ABORTED', 'The tool call was aborted.');
  }
  if (input.revision !== input.currentRevision) {
    return failResult(call.id, 'STALE_TOOLS', 'The tool list changed. Discover tools again.');
  }
  const handle = input.handles.get(call.toolId);
  if (handle === undefined) {
    return failResult(call.id, 'TOOL_UNAVAILABLE', 'This tool is not available.');
  }
  if (!validateToolArguments(handle.definition.inputSchema, call.arguments)) {
    return failResult(
      call.id,
      'INVALID_ARGUMENTS',
      'The tool arguments do not match the input schema.',
    );
  }
  let context;
  try {
    context = getNativeContext();
  } catch (error) {
    if (error instanceof AgentError) return failResult(call.id, error.code, error.message);
    return failResult(call.id, 'EXECUTION_FAILED', 'Tool execution failed.');
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
      return failResult(call.id, 'ABORTED', 'The tool call was aborted.');
    }
    return failResult(
      call.id,
      'EXECUTION_FAILED',
      error instanceof Error ? error.message : 'Tool execution failed.',
    );
  }
  return normalizeResult(call.id, raw);
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
      return failResult(callId, 'EXECUTION_FAILED', 'The tool result is not valid JSON.');
    }
    return fromJson(callId, parsed);
  }
  return fromJson(callId, raw);
}

function fromJson(callId: string, value: unknown): ToolResult {
  if (!isJson(value)) {
    return failResult(callId, 'EXECUTION_FAILED', 'The tool result is not valid JSON.');
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
