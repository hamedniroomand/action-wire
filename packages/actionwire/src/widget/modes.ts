import type { Activity, AssistantState, ErrorCode, Proposal } from '~/core';

export type BarUi = { open: boolean; draft: string };

export type BarMode =
  | { kind: 'collapsed' }
  | { kind: 'review'; proposal: Proposal }
  | { kind: 'error'; code: ErrorCode; retry: string | undefined }
  | { kind: 'tool'; toolId: string; index: number; total: number }
  | { kind: 'busy' }
  | { kind: 'receipt'; text: string; tools: number }
  | { kind: 'idle'; draft: string; history: boolean };

const ACTIVE: ReadonlySet<Activity['status']> = new Set([
  'running',
  'preparing',
  'needs-input',
  'ready-for-review',
  'approved',
]);

export function toBarMode(state: AssistantState, ui: BarUi): BarMode {
  if (!ui.open) return { kind: 'collapsed' };
  const review = state.proposals.find((proposal) => proposal.status === 'ready-for-review');
  if (review !== undefined) {
    return { kind: 'review', proposal: review };
  }
  if (state.error !== undefined) {
    return { kind: 'error', code: state.error.code, retry: lastUserText(state) };
  }
  const turn = turnActivities(state);
  if (state.busy) {
    const position = turn.findIndex((activity) => ACTIVE.has(activity.status));
    const active = turn[position];
    if (active !== undefined) {
      return { kind: 'tool', toolId: active.call.toolId, index: position + 1, total: turn.length };
    }
    return { kind: 'busy' };
  }
  const last = state.timeline.at(-1);
  if (ui.draft === '' && last?.kind === 'message') {
    const message = state.messages[last.index];
    if (message?.role === 'assistant' && message.content.trim() !== '') {
      return { kind: 'receipt', text: firstLine(message.content), tools: turn.length };
    }
  }
  return { kind: 'idle', draft: ui.draft, history: state.timeline.length > 0 };
}

/** Activities after the last user message, in timeline order. */
export function turnActivities(state: AssistantState): readonly Activity[] {
  let start = 0;
  state.timeline.forEach((item, position) => {
    if (item.kind === 'message' && state.messages[item.index]?.role === 'user') start = position;
  });
  const ids: string[] = [];
  for (const item of state.timeline.slice(start)) {
    if (item.kind === 'activity') ids.push(item.callId);
  }
  return ids.flatMap((id) => state.activities.filter((activity) => activity.call.id === id));
}

export function lastUserText(state: AssistantState): string | undefined {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];
    if (message?.role === 'user') return message.content;
  }
  return undefined;
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  );
}
