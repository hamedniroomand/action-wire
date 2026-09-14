import { expect, it, vi } from 'vitest';

import { createAgentBridge } from '~/agent/bridge';
import type { AssistantState, ToolDefinition, ToolSource } from '~/core';

const remove: ToolDefinition = {
  id: 'delete',
  name: 'deleteProject',
  description: 'Delete a project',
  inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
  consequential: true,
};

function source(execute: ToolSource['execute'], discover: ToolSource['discover']): ToolSource {
  return { discover, execute, subscribe: () => () => {}, dispose: () => {} };
}

function readyForCall(state: AssistantState, callId: string) {
  return state.proposals.find(
    (proposal) => proposal.call.id === callId && proposal.status === 'ready-for-review',
  );
}

it('does not run a delete handler before approval or after denial, and approval executes once', async () => {
  const execute = vi.fn().mockResolvedValue({ callId: 'c1', ok: true, text: 'Deleted' });
  const generate = vi
    .fn()
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c1', toolId: 'delete', arguments: { name: 'Phoenix' } }],
    })
    .mockResolvedValueOnce({ text: 'Cancelled.', toolCalls: [] })
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c2', toolId: 'delete', arguments: { name: 'Phoenix' } }],
    })
    .mockResolvedValueOnce({ text: 'Deleted Phoenix.', toolCalls: [] });
  const assistant = createAgentBridge({
    source: source(execute, async () => ({ revision: 1, tools: [remove] })),
    model: { generate },
  });
  const denied = assistant.send('Delete Phoenix.');
  await vi.waitFor(() => expect(readyForCall(assistant.getState(), 'c1')).toBeDefined());
  expect(execute).toHaveBeenCalledTimes(0);
  const first = readyForCall(assistant.getState(), 'c1')!;
  assistant.confirm('wrong', 1, true);
  assistant.confirm(first.id, first.version, false);
  await denied;
  expect(execute).toHaveBeenCalledTimes(0);

  const approved = assistant.send('Delete Phoenix again.');
  await vi.waitFor(() => expect(readyForCall(assistant.getState(), 'c2')).toBeDefined());
  const second = readyForCall(assistant.getState(), 'c2')!;
  assistant.confirm(second.id, second.version, true);
  assistant.confirm(second.id, second.version, true);
  await approved;
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls[0]?.[0]).toEqual({
    id: 'c2',
    toolId: 'delete',
    arguments: { name: 'Phoenix' },
  });
  assistant.dispose();
});

it('requires a fresh request when the tool revision changes', async () => {
  const execute = vi.fn().mockResolvedValue({ callId: 'c1', ok: true, text: 'Deleted' });
  let revision = 1;
  const generate = vi
    .fn()
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c1', toolId: 'delete', arguments: { name: 'Phoenix' } }],
    })
    .mockResolvedValueOnce({ text: 'Stopped.', toolCalls: [] });
  const assistant = createAgentBridge({
    source: source(execute, async () => ({ revision, tools: [remove] })),
    model: { generate },
  });
  const sending = assistant.send('Delete Phoenix.');
  await vi.waitFor(() => expect(readyForCall(assistant.getState(), 'c1')).toBeDefined());
  revision = 2;
  const proposal = readyForCall(assistant.getState(), 'c1')!;
  assistant.confirm(proposal.id, proposal.version, true);
  await sending;
  expect(execute).toHaveBeenCalledTimes(0);
  assistant.dispose();
});

it('uses the tool title and Confirm label for consequential tools', async () => {
  const removeWithTitle: ToolDefinition = {
    ...remove,
    title: 'Remove project permanently',
  };
  const execute = vi.fn().mockResolvedValue({ callId: 'c1', ok: true, text: 'Removed' });
  const generate = vi.fn().mockResolvedValueOnce({
    text: '',
    toolCalls: [{ id: 'c1', toolId: 'delete', arguments: { name: 'Phoenix' } }],
  });
  const assistant = createAgentBridge({
    source: source(execute, async () => ({ revision: 1, tools: [removeWithTitle] })),
    model: { generate },
  });
  const sending = assistant.send('Remove Phoenix.');
  await vi.waitFor(() => expect(readyForCall(assistant.getState(), 'c1')).toBeDefined());
  const proposal = readyForCall(assistant.getState(), 'c1')!;
  expect(proposal.title).toBe('Remove project permanently');
  assistant.confirm(proposal.id, proposal.version, false);
  await sending;
  assistant.dispose();
});

it('does not consume the operation timeout while the user reviews', async () => {
  const execute = vi.fn().mockResolvedValue({ callId: 'c1', ok: true, text: 'Deleted' });
  const generate = vi.fn().mockResolvedValueOnce({
    text: '',
    toolCalls: [{ id: 'c1', toolId: 'delete', arguments: { name: 'Phoenix' } }],
  });
  const assistant = createAgentBridge({
    source: source(execute, async () => ({ revision: 1, tools: [remove] })),
    model: { generate },
    timeoutMs: 50,
  });
  const sending = assistant.send('Delete Phoenix.');
  await vi.waitFor(() => expect(readyForCall(assistant.getState(), 'c1')).toBeDefined());
  await new Promise((resolve) => setTimeout(resolve, 120));
  const proposal = readyForCall(assistant.getState(), 'c1')!;
  assistant.confirm(proposal.id, proposal.version, true);
  await sending;
  expect(execute).toHaveBeenCalledTimes(1);
  assistant.dispose();
});
