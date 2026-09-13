import { createEmitter } from '@webmcp-agent/core';
import type { AssistantState } from '@webmcp-agent/core';

const empty: AssistantState = Object.freeze({
  timeline: Object.freeze([]),
  messages: Object.freeze([]),
  activities: Object.freeze([]),
  busy: false,
});

export function createSessionStore() {
  const changes = createEmitter<AssistantState>();
  let state: AssistantState = empty;
  let disposed = false;

  return {
    getState(): AssistantState {
      return state;
    },
    subscribe(listener: (next: AssistantState) => void): () => void {
      return changes.subscribe(listener);
    },
    update(write: (current: AssistantState) => AssistantState): AssistantState {
      if (disposed) return state;
      state = freezeState(write(state));
      changes.emit(state);
      return state;
    },
    clear(): void {
      if (disposed) return;
      state = empty;
      changes.emit(state);
    },
    dispose(): void {
      disposed = true;
      changes.clear();
    },
  };
}

function freezeState(value: AssistantState): AssistantState {
  return freeze({
    timeline: [...value.timeline],
    messages: [...value.messages],
    activities: [...value.activities],
    busy: value.busy,
    ...(value.confirmation === undefined ? {} : { confirmation: value.confirmation }),
    ...(value.error === undefined ? {} : { error: value.error }),
  });
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
