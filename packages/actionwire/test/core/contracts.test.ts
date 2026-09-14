import { expect, it } from 'vitest';

import type { AssistantState, ToolCall, ToolSource, ToolStatus } from '~/core';

it('connects a typed tool source to a caller with a result ID', async () => {
  const source: ToolSource = {
    discover: async () => ({ revision: 1, tools: [] }),
    execute: async (call) => ({
      callId: call.id,
      ok: true,
      text: typeof call.arguments['text'] === 'string' ? call.arguments['text'] : '',
    }),
    subscribe: () => () => {},
    dispose: () => {},
  };
  const call: ToolCall = { id: 'call-1', toolId: 'echo', arguments: { text: 'Hello' } };
  expect(await source.execute(call, 1)).toEqual({ callId: 'call-1', ok: true, text: 'Hello' });
});

const state: AssistantState = {
  messages: [],
  activities: [],
  timeline: [],
  context: [],
  proposals: [],
  busy: false,
};
const status: ToolStatus = 'ready-for-review';
// @ts-expect-error This status is not part of the protocol.
const invalidStatus: ToolStatus = 'done';
// @ts-expect-error Tool input must contain JSON values.
const invalidCall: ToolCall = { id: '1', toolId: 'echo', arguments: { run: () => {} } };
void [state, status, invalidStatus, invalidCall];
