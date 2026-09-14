import { AgentError } from '~/core/errors';
import type { Json } from '~/core/types';

export function copyJson(value: unknown, ancestors = new Set<object>()): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || ancestors.has(value)) {
    throw new AgentError('INVALID_SCHEMA', 'Use finite JSON values without cycles.');
  }
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    throw new AgentError('INVALID_SCHEMA', 'Use plain JSON objects.');
  }
  ancestors.add(value);
  try {
    return Array.isArray(value)
      ? Array.from(value, (item) => copyJson(item, ancestors))
      : Object.fromEntries(
          Object.entries(value)
            .toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
            .map(([key, item]) => [key, copyJson(item, ancestors)]),
        );
  } finally {
    ancestors.delete(value);
  }
}

export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function isJson(value: unknown): value is Json {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value).every(isJson);
}
