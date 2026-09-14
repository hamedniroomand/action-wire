import type { ToolResult } from '~/core/types';

export type ErrorCode =
  | 'UNSUPPORTED_WEBMCP'
  | 'DISCOVERY_FAILED'
  | 'INVALID_SCHEMA'
  | 'TOOL_UNAVAILABLE'
  | 'STALE_TOOLS'
  | 'INVALID_ARGUMENTS'
  | 'EXECUTION_FAILED'
  | 'CONFIRMATION_DENIED'
  | 'INVALIDATED'
  | 'OUTCOME_UNKNOWN'
  | 'ABORTED'
  | 'TIMEOUT'
  | 'MODEL_ERROR'
  | 'TURN_LIMIT'
  | 'BUSY';

export class AgentError extends Error {
  override readonly name = 'AgentError';

  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function failResult(callId: string, code: ErrorCode, text: string): ToolResult {
  return { callId, ok: false, text, code };
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
}
