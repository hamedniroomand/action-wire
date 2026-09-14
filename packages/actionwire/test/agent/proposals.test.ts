import { expect, it, vi } from 'vitest';

import { createAgentBridge } from '~/agent/bridge';
import {
  freezeProposal,
  initialProposal,
  invalidateDependents,
  prepareProposal,
} from '~/agent/proposals';
import type { ToolDefinition, ToolSource } from '~/core';

const write: ToolDefinition = {
  id: 'write',
  name: 'write',
  description: 'Write',
  inputSchema: {
    type: 'object',
    properties: { title: { type: 'string' }, n: { type: 'integer' } },
  },
  consequential: true,
};

it('invalidates later proposals when an earlier one is excluded without independence', () => {
  const first = freezeProposal(
    initialProposal({
      call: { id: 'c1', toolId: 'write', arguments: {} },
      tool: write,
      toolRevision: 1,
      context: [],
    }),
  );
  const second = freezeProposal(
    initialProposal({
      call: { id: 'c2', toolId: 'write', arguments: {} },
      tool: write,
      toolRevision: 1,
      context: [],
    }),
  );
  const next = invalidateDependents([first, second], 0, 'Changed');
  expect(next[1]?.status).toBe('invalidated');
});

it('prepares a read-only proposal without preview support as ready-for-review', async () => {
  const proposal = initialProposal({
    call: { id: 'c1', toolId: 'write', arguments: { title: 'Q1' } },
    tool: write,
    toolRevision: 1,
    context: [],
  });
  const source: ToolSource = {
    discover: async () => ({ revision: 1, tools: [write] }),
    execute: vi.fn(),
    subscribe: () => () => {},
    dispose: () => {},
  };
  const prepared = await prepareProposal({
    proposal,
    tool: write,
    snapshot: { revision: 1, tools: [write] },
    source,
    turnSignal: new AbortController().signal,
    timeoutMs: 1000,
    previewToken: { turn: 1, version: 1 },
    turn: 1,
  });
  expect(prepared.status).toBe('ready-for-review');
  expect(prepared.preview?.kind).toBe('unavailable');
});

it('does not approve a proposal with a stale version', async () => {
  const execute = vi.fn();
  const generate = vi.fn().mockResolvedValueOnce({
    text: '',
    toolCalls: [{ id: 'c1', toolId: 'write', arguments: {} }],
  });
  const assistant = createAgentBridge({
    source: {
      discover: async () => ({ revision: 1, tools: [write] }),
      execute,
      subscribe: () => () => {},
      dispose: () => {},
    },
    model: { generate },
  });
  const sending = assistant.send('Do it.');
  await vi.waitFor(() =>
    expect(
      assistant.getState().proposals.find((p) => p.status === 'ready-for-review'),
    ).toBeDefined(),
  );
  const proposal = assistant.getState().proposals[0]!;
  assistant.confirm(proposal.id, proposal.version + 1, true);
  assistant.confirm(proposal.id, proposal.version, true);
  await sending;
  expect(execute).toHaveBeenCalledTimes(1);
  assistant.dispose();
});

it('runs only one write when review.independent is true and the other is excluded', async () => {
  const execute = vi.fn().mockResolvedValue({ callId: 'x', ok: true, text: 'ok' });
  const generate = vi
    .fn()
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [
        { id: 'c1', toolId: 'write', arguments: { n: 1 } },
        { id: 'c2', toolId: 'write', arguments: { n: 2 } },
      ],
    })
    .mockResolvedValueOnce({ text: 'Done.', toolCalls: [] });
  const assistant = createAgentBridge({
    source: {
      discover: async () => ({ revision: 1, tools: [write] }),
      execute,
      subscribe: () => () => {},
      dispose: () => {},
    },
    model: { generate },
    review: { independent: () => true },
  });
  const sending = assistant.send('Two writes.');
  await vi.waitFor(() => expect(assistant.getState().proposals).toHaveLength(2));
  const [first, second] = assistant.getState().proposals;
  assistant.confirm(first!.id, first!.version, true);
  expect(execute).toHaveBeenCalledTimes(0);
  assistant.confirm(second!.id, second!.version, false);
  assistant.confirm(first!.id, first!.version, true);
  await sending;
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls[0]?.[0].id).toBe('c1');
  assistant.dispose();
});

it('updates stored call arguments synchronously on edit', async () => {
  const generate = vi.fn().mockResolvedValueOnce({
    text: '',
    toolCalls: [{ id: 'c1', toolId: 'write', arguments: { n: 1 } }],
  });
  const assistant = createAgentBridge({
    source: {
      discover: async () => ({ revision: 1, tools: [write] }),
      execute: vi.fn(),
      subscribe: () => () => {},
      dispose: () => {},
    },
    model: { generate },
  });
  void assistant.send('Edit.');
  await vi.waitFor(() =>
    expect(assistant.getState().proposals[0]?.status).toBe('ready-for-review'),
  );
  const proposal = assistant.getState().proposals[0]!;
  assistant.edit(proposal.id, proposal.version, { n: 9 });
  expect(assistant.getState().proposals[0]?.call.arguments).toEqual({ n: 9 });
  assistant.cancel();
  assistant.dispose();
});
