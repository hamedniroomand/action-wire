export type DebugLog = (step: string, detail: Record<string, unknown>) => void;

const LOG_BODY_MAX = 12_000;

export function createDebugLog(channel: string, enabled: boolean): DebugLog {
  if (!enabled) return () => {};
  return (step, detail) => {
    console.warn(`[action-wire:${channel}]`, step, detail);
  };
}

export function clipForLog(value: string): string {
  if (value.length <= LOG_BODY_MAX) return value;
  return `${value.slice(0, LOG_BODY_MAX)}… (${value.length} chars)`;
}

export function payloadForLog(payload: unknown): unknown {
  try {
    const text = JSON.stringify(payload);
    if (text.length <= LOG_BODY_MAX) return payload;
    return { clipped: clipForLog(text) };
  } catch {
    return String(payload);
  }
}
