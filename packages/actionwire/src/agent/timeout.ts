import { AgentError } from '~/core';

export function assertPositiveMs(value: number | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0) {
    throw new AgentError('MODEL_ERROR', `${label} must be a positive number.`);
  }
  return value;
}

export function operationSignal(turn: AbortSignal, timeoutMs: number): AbortSignal {
  if (turn.aborted) return turn;
  return AbortSignal.any([turn, AbortSignal.timeout(timeoutMs)]);
}

export async function runWithOperationTimeout<T>(
  turn: AbortSignal,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const op = operationSignal(turn, timeoutMs);
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      run(op).catch((error) => {
        if (op.aborted) throw abortFromSignal(op);
        throw error;
      }),
      new Promise<never>((_, reject) => {
        if (op.aborted) {
          reject(abortFromSignal(op));
          return;
        }
        onAbort = () => reject(abortFromSignal(op));
        op.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort !== undefined) op.removeEventListener('abort', onAbort);
  }
}

export function abortFromSignal(signal: AbortSignal): AgentError {
  const reason = signal.reason;
  if (isTimeout(reason) || isTimeout(signal)) {
    return new AgentError('TIMEOUT', 'The assistant timed out.');
  }
  return new AgentError('ABORTED', 'The assistant was cancelled.');
}

function isTimeout(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && Reflect.get(value, 'name') === 'TimeoutError'
  );
}
