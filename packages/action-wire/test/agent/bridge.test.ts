import { expect, it, vi } from 'vitest';

import { createAgentBridge } from '~/agent/bridge';
import { AgentError } from '~/core';
import type { ToolDefinition, ToolSource } from '~/core';

const list: ToolDefinition = {
  id: 'list',
  name: 'listProjects',
  description: 'List projects',
  inputSchema: { type: 'object' },
  readOnly: true,
};
const open: ToolDefinition = {
  id: 'open',
  name: 'openProject',
  description: 'Open a project',
  inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
  readOnly: true,
};
const rename: ToolDefinition = {
  id: 'rename',
  name: 'renameProject',
  description: 'Rename a project',
  inputSchema: { type: 'object' },
  readOnly: true,
};

function source(
  execute: ToolSource['execute'],
  tools: ToolDefinition[] = [list, open],
): ToolSource {
  return {
    discover: async () => ({ revision: 1, tools }),
    execute,
    subscribe: () => () => {},
    dispose: () => {},
  };
}

it('returns an existing handler result to the model before the final answer', async () => {
  const execute = vi.fn().mockResolvedValue({ callId: 'c1', ok: true, text: 'Phoenix' });
  const generate = vi
    .fn()
    .mockResolvedValueOnce({ text: '', toolCalls: [{ id: 'c1', toolId: 'list', arguments: {} }] })
    .mockResolvedValueOnce({ text: 'Your latest project is Phoenix.', toolCalls: [] });
  const assistant = createAgentBridge({
    source: {
      discover: async () => ({
        revision: 1,
        tools: [
          {
            id: 'list',
            name: 'listProjects',
            description: 'List projects',
            inputSchema: { type: 'object' },
            readOnly: true,
          },
        ],
      }),
      execute,
      subscribe: () => () => {},
      dispose: () => {},
    },
    model: { generate },
  });
  await assistant.send('What is my latest project?');
  expect(execute).toHaveBeenCalledTimes(1);
  expect(generate.mock.calls[1]?.[0].messages).toContainEqual({
    role: 'tool',
    content: 'Phoenix',
    callId: 'c1',
  });
  expect(assistant.getState().busy).toBe(false);
  expect(assistant.getState().messages.at(-1)?.content).toBe('Your latest project is Phoenix.');
  assistant.dispose();
});

it('opens the latest project then answers, and a later rename sees prior context', async () => {
  const execute = vi
    .fn()
    .mockResolvedValueOnce({ callId: 'c1', ok: true, text: 'Opened Phoenix' })
    .mockResolvedValueOnce({ callId: 'c2', ok: true, text: 'Renamed' });
  const generate = vi
    .fn()
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c1', toolId: 'open', arguments: { name: 'Phoenix' } }],
    })
    .mockResolvedValueOnce({ text: 'I found Phoenix. Opening it now.', toolCalls: [] })
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c2', toolId: 'rename', arguments: { name: 'Aurora' } }],
    })
    .mockResolvedValueOnce({ text: 'Renamed to Aurora.', toolCalls: [] });
  const assistant = createAgentBridge({
    source: source(execute, [list, open, rename]),
    model: { generate },
  });
  await assistant.send('Open my latest project.');
  await assistant.send('Rename it to Aurora.');
  expect(execute).toHaveBeenCalledTimes(2);
  const renameMessages = generate.mock.calls[2]?.[0].messages ?? [];
  expect(renameMessages).toContainEqual({ role: 'user', content: 'Open my latest project.' });
  expect(renameMessages).toContainEqual({ role: 'user', content: 'Rename it to Aurora.' });
  expect(assistant.getState().messages.at(-1)?.content).toBe('Renamed to Aurora.');
  assistant.dispose();
});

it('returns tool errors to the model, rejects concurrent send as BUSY, and stops after TURN_LIMIT', async () => {
  const execute = vi.fn().mockResolvedValue({
    callId: 'c1',
    ok: false,
    text: 'Missing project',
    code: 'EXECUTION_FAILED',
  });
  const generate = vi
    .fn()
    .mockResolvedValueOnce({ text: '', toolCalls: [{ id: 'c1', toolId: 'open', arguments: {} }] })
    .mockResolvedValueOnce({ text: 'The open failed.', toolCalls: [] });
  const assistant = createAgentBridge({ source: source(execute), model: { generate } });
  await assistant.send('Open it.');
  expect(generate.mock.calls[1]?.[0].messages).toContainEqual({
    role: 'tool',
    content: 'Missing project',
    callId: 'c1',
  });
  assistant.dispose();

  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const busyGenerate = vi.fn().mockImplementation(async () => {
    await blocked;
    return { text: 'done', toolCalls: [] };
  });
  const busy = createAgentBridge({
    source: source(async () => ({ callId: 'x', ok: true, text: '' })),
    model: { generate: busyGenerate },
  });
  const first = busy.send('one');
  await vi.waitFor(() => expect(busyGenerate).toHaveBeenCalled());
  await expect(busy.send('two')).rejects.toMatchObject({ code: 'BUSY' });
  await expect(busy.send('two')).rejects.toBeInstanceOf(AgentError);
  release();
  await first;
  busy.dispose();

  const looping = vi.fn().mockResolvedValue({
    text: '',
    toolCalls: [{ id: 'loop', toolId: 'list', arguments: {} }],
  });
  const limited = createAgentBridge({
    source: source(async (call) => ({ callId: call.id, ok: true, text: 'ok' })),
    model: { generate: looping },
    maxRounds: 2,
  });
  await limited.send('loop');
  expect(limited.getState().error?.code).toBe('TURN_LIMIT');
  expect(looping).toHaveBeenCalledTimes(2);
  limited.dispose();
});

it('does not dispatch later tool calls after cancel', async () => {
  const execute = vi
    .fn()
    .mockImplementation(async (call: { id: string }, _revision: number, signal?: AbortSignal) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 50);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      return { callId: call.id, ok: true, text: 'ran' };
    });
  const generate = vi.fn().mockResolvedValue({
    text: '',
    toolCalls: [
      { id: 'c1', toolId: 'list', arguments: {} },
      { id: 'c2', toolId: 'open', arguments: {} },
    ],
  });
  const assistant = createAgentBridge({ source: source(execute), model: { generate } });
  const sending = assistant.send('Go');
  await vi.waitFor(() => expect(execute).toHaveBeenCalled());
  assistant.cancel();
  await sending;
  expect(execute).toHaveBeenCalledTimes(1);
  expect(assistant.getState().busy).toBe(false);
  assistant.dispose();
});

it('records TIMEOUT when the model hang exceeds timeoutMs', async () => {
  const assistant = createAgentBridge({
    source: source(async (call) => ({ callId: call.id, ok: true, text: '' })),
    model: {
      generate: ({ signal }) =>
        new Promise((_, reject) => {
          const fail = () => reject(signal?.reason ?? new Error('aborted'));
          if (signal?.aborted) {
            fail();
            return;
          }
          signal?.addEventListener('abort', fail, { once: true });
        }),
    },
    timeoutMs: 20,
  });
  await assistant.send('Hello');
  expect(assistant.getState().error?.code).toBe('TIMEOUT');
  assistant.dispose();
});

it('records ABORTED when cancel stops the model', async () => {
  const generate = vi.fn(
    ({ signal }: { signal?: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        const fail = () => reject(signal?.reason ?? new Error('aborted'));
        if (signal?.aborted) {
          fail();
          return;
        }
        signal?.addEventListener('abort', fail, { once: true });
      }),
  );
  const assistant = createAgentBridge({
    source: source(async (call) => ({ callId: call.id, ok: true, text: '' })),
    model: { generate },
  });
  const sending = assistant.send('Hello');
  await vi.waitFor(() => expect(generate).toHaveBeenCalled());
  assistant.cancel();
  await sending;
  expect(assistant.getState().error?.code).toBe('ABORTED');
  assistant.dispose();
});
