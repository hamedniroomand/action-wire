import type { ErrorCode } from '@webmcp-agent/core';

export function emptyCopy(): string {
  return 'Send a message to start.';
}

export function busyCopy(): string {
  return 'The assistant is thinking…';
}

const ERRORS = {
  UNSUPPORTED_WEBMCP: 'This browser does not support WebMCP.',
  DISCOVERY_FAILED: 'The assistant could not read the tools on this page.',
  INVALID_SCHEMA: 'A tool definition is not valid.',
  TOOL_UNAVAILABLE: 'This tool is not available.',
  STALE_TOOLS: 'The tool list changed. Try again.',
  INVALID_ARGUMENTS: 'The tool input is not valid.',
  EXECUTION_FAILED: 'The tool failed.',
  CONFIRMATION_DENIED: 'The action was cancelled.',
  ABORTED: 'The assistant was cancelled.',
  TIMEOUT: 'The assistant timed out.',
  MODEL_ERROR: 'The assistant could not complete the turn.',
  TURN_LIMIT: 'The assistant reached the turn limit.',
  BUSY: 'The assistant is busy.',
} satisfies Record<ErrorCode, string>;

export function friendlyError(code: ErrorCode): string {
  return ERRORS[code];
}
