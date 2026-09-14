import { expect, it } from 'vitest';

import type { Activity, AssistantState, Message, Proposal } from '~/core';
import { toBarMode } from '~/widget/modes';

function state(over: Partial<AssistantState> = {}): AssistantState {
  return {
    timeline: [],
    messages: [],
    activities: [],
    context: [],
    proposals: [],
    busy: false,
    ...over,
  };
}
const open = { open: true, draft: '' };
const user: Message = { role: 'user', content: 'Rename Alpha to Atlas' };
const reply: Message = {
  role: 'assistant',
  content: 'Renamed Alpha to Atlas.\nThe list has 4 projects.',
};
function activity(id: string, status: Activity['status']): Activity {
  return { call: { id, toolId: 'renameProject', arguments: {} }, status };
}

it('is collapsed when closed, whatever the state', () => {
  expect(toBarMode(state({ busy: true }), { open: false, draft: 'x' })).toEqual({
    kind: 'collapsed',
  });
});

it('prefers review over every other state', () => {
  const proposal: Proposal = {
    id: 'p1',
    call: activity('c1', 'ready-for-review').call,
    version: 1,
    toolRevision: 1,
    context: [],
    targets: [],
    title: 'Delete Alpha?',
    status: 'ready-for-review',
  };
  const mode = toBarMode(
    state({ busy: true, proposals: [proposal], error: { code: 'TIMEOUT', message: '' } }),
    open,
  );
  expect(mode).toEqual({ kind: 'review', proposal });
});

it('shows the error with the last user text for retry', () => {
  const mode = toBarMode(
    state({ messages: [user], error: { code: 'MODEL_ERROR', message: '' } }),
    open,
  );
  expect(mode).toEqual({ kind: 'error', code: 'MODEL_ERROR', retry: 'Rename Alpha to Atlas' });
});

it('shows the running tool with its position in the turn', () => {
  const s = state({
    busy: true,
    messages: [user],
    activities: [activity('c1', 'succeeded'), activity('c2', 'running')],
    timeline: [
      { kind: 'message', index: 0 },
      { kind: 'activity', callId: 'c1' },
      { kind: 'activity', callId: 'c2' },
    ],
  });
  expect(toBarMode(s, open)).toEqual({
    kind: 'tool',
    toolId: 'renameProject',
    index: 2,
    total: 2,
  });
});

it('is busy when no tool is running', () => {
  expect(
    toBarMode(
      state({ busy: true, messages: [user], timeline: [{ kind: 'message', index: 0 }] }),
      open,
    ),
  ).toEqual({ kind: 'busy' });
});

it('shows a receipt after a reply and counts only this turn', () => {
  const s = state({
    messages: [user, reply, user, reply],
    activities: [
      activity('c1', 'succeeded'),
      activity('c2', 'succeeded'),
      activity('c3', 'succeeded'),
    ],
    timeline: [
      { kind: 'message', index: 0 },
      { kind: 'activity', callId: 'c1' },
      { kind: 'message', index: 1 },
      { kind: 'message', index: 2 },
      { kind: 'activity', callId: 'c2' },
      { kind: 'activity', callId: 'c3' },
      { kind: 'message', index: 3 },
    ],
  });
  expect(toBarMode(s, open)).toEqual({
    kind: 'receipt',
    text: 'Renamed Alpha to Atlas.',
    tools: 2,
  });
});

it('drops the receipt on the first keystroke', () => {
  const s = state({
    messages: [user, reply],
    timeline: [
      { kind: 'message', index: 0 },
      { kind: 'message', index: 1 },
    ],
  });
  expect(toBarMode(s, { open: true, draft: 'R' })).toEqual({
    kind: 'idle',
    draft: 'R',
    history: true,
  });
});

it('is idle with no history on a fresh session', () => {
  expect(toBarMode(state(), open)).toEqual({ kind: 'idle', draft: '', history: false });
});
