import { expect, it, vi } from 'vitest';

import { createAgentBridge } from '~/agent/bridge';
import type { ToolDefinition, ToolSource } from '~/core';

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
  await vi.waitFor(() => expect(assistant.getState().confirmation?.id).toBe('c1'));
  expect(execute).toHaveBeenCalledTimes(0);
  assistant.confirm('wrong', true);
  assistant.confirm('c1', false);
  await denied;
  expect(execute).toHaveBeenCalledTimes(0);

  const approved = assistant.send('Delete Phoenix again.');
  await vi.waitFor(() => expect(assistant.getState().confirmation?.id).toBe('c2'));
  assistant.confirm('c2', true);
  assistant.confirm('c2', true);
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
  await vi.waitFor(() => expect(assistant.getState().confirmation?.id).toBe('c1'));
  revision = 2;
  assistant.confirm('c1', true);
  await sending;
  expect(execute).toHaveBeenCalledTimes(0);
  assistant.dispose();
});
