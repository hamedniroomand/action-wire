export type ErrorCode =
  | 'UNSUPPORTED_WEBMCP'
  | 'DISCOVERY_FAILED'
  | 'INVALID_SCHEMA'
  | 'TOOL_UNAVAILABLE'
  | 'STALE_TOOLS'
  | 'INVALID_ARGUMENTS'
  | 'EXECUTION_FAILED'
  | 'CONFIRMATION_DENIED'
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
