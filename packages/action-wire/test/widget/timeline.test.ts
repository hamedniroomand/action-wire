// @vitest-environment happy-dom

import { afterEach, expect, it, vi } from 'vitest';

import type { AgentAdapter, AssistantOptions, ToolDefinition, ToolSource } from '~/core';
import { createAssistant } from '~/widget';

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('action-wire').forEach((node) => {
    node.remove();
  });
});

const list: ToolDefinition = {
  id: 'list',
  name: 'listProjects',
  description: 'List projects',
  inputSchema: { type: 'object' },
  readOnly: true,
};

function source(
  execute: ToolSource['execute'] = async (call) => ({
    callId: call.id,
    ok: true,
    text: '',
  }),
): ToolSource {
  return {
    discover: async () => ({ revision: 1, tools: [list] }),
    execute,
    subscribe: () => () => {},
    dispose: () => {},
  };
}

function options(overrides: Partial<AssistantOptions> = {}): AssistantOptions {
  return {
    model: { generate: async () => ({ text: 'Hi.', toolCalls: [] }) },
    source: source(),
    ...overrides,
  };
}

function shadow(): ShadowRoot {
  const host = document.querySelector('action-wire');
  if (host?.shadowRoot === null || host === null) throw new Error('missing widget');
  return host.shadowRoot;
}

function open(assistant: ReturnType<typeof createAssistant>): void {
  assistant.mount();
  const launcher = shadow().querySelector('button[aria-label="Open assistant"]');
  if (!(launcher instanceof HTMLButtonElement)) throw new Error('missing launcher');
  launcher.click();
}

function timeline(): HTMLElement {
  const root = shadow().querySelector('.timeline');
  if (!(root instanceof HTMLElement)) throw new Error('missing timeline');
  return root;
}

function submit(text: string): void {
  const field = shadow().querySelector('textarea');
  if (!(field instanceof HTMLTextAreaElement)) throw new Error('missing composer');
  field.value = text;
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
}

function cards(): HTMLElement[] {
  return [...timeline().querySelectorAll('[data-call-id]')].filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
}

it('updates one tool card when the result arrives', async () => {
  const execute = vi.fn().mockResolvedValue({
    callId: 'c1',
    ok: true,
    text: 'Phoenix',
    data: { name: 'Phoenix' },
  });
  const generate = vi
    .fn<AgentAdapter['generate']>()
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c1', toolId: 'list', arguments: {} }],
    })
    .mockResolvedValueOnce({ text: 'Your latest project is Phoenix.', toolCalls: [] });
  const assistant = createAssistant(options({ model: { generate }, source: source(execute) }));
  open(assistant);
  submit('What is my latest project?');
  await vi.waitFor(() => {
    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.textContent).toContain('Success');
    expect(cards()[0]?.textContent).toContain('Phoenix');
  });
  expect(timeline().textContent).toContain('Your latest project is Phoenix.');
  assistant.dispose();
});

it('preserves the user scroll position', async () => {
  const generate = vi
    .fn<AgentAdapter['generate']>()
    .mockResolvedValueOnce({ text: 'First.', toolCalls: [] })
    .mockResolvedValueOnce({ text: 'Second.', toolCalls: [] });
  const assistant = createAssistant(options({ model: { generate } }));
  open(assistant);
  submit('One');
  await vi.waitFor(() => {
    expect(timeline().textContent).toContain('First.');
  });
  const root = timeline();
  Object.defineProperties(root, {
    scrollHeight: { configurable: true, get: () => 2000 },
    clientHeight: { configurable: true, get: () => 200 },
  });
  root.scrollTop = 40;
  submit('Two');
  await vi.waitFor(() => {
    expect(timeline().textContent).toContain('Second.');
  });
  expect(root.scrollTop).toBe(40);
  assistant.dispose();
});

it('keeps malicious HTML inert', async () => {
  const generate = vi.fn().mockResolvedValue({
    text: '<img src="x" onerror="alert(1)">',
    toolCalls: [],
  });
  const assistant = createAssistant(options({ model: { generate } }));
  open(assistant);
  submit('Hello');
  await vi.waitFor(() => {
    expect(timeline().textContent).toContain('<img src="x" onerror="alert(1)">');
  });
  expect(timeline().querySelector('img')).toBeNull();
  assistant.dispose();
});

it('hides raw JSON unless developer mode is on', async () => {
  const execute = vi.fn().mockResolvedValue({
    callId: 'c1',
    ok: true,
    text: 'Phoenix',
    data: { name: 'Phoenix' },
  });
  const generate = vi
    .fn<AgentAdapter['generate']>()
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c1', toolId: 'list', arguments: {} }],
    })
    .mockResolvedValueOnce({ text: 'Done.', toolCalls: [] });
  const assistant = createAssistant(options({ model: { generate }, source: source(execute) }));
  open(assistant);
  submit('List');
  await vi.waitFor(() => {
    expect(cards()).toHaveLength(1);
  });
  expect(cards()[0]?.textContent).toContain('Phoenix');
  expect(cards()[0]?.textContent).not.toContain('"name":"Phoenix"');
  assistant.dispose();

  const debug = createAssistant(
    options({ model: { generate }, source: source(execute), developerMode: true }),
  );
  generate
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c1', toolId: 'list', arguments: {} }],
    })
    .mockResolvedValueOnce({ text: 'Done.', toolCalls: [] });
  open(debug);
  submit('List');
  await vi.waitFor(() => {
    expect(cards()[0]?.textContent).toContain('"name": "Phoenix"');
  });
  debug.dispose();
});

it('shows readable empty, error, and model-busy views', async () => {
  const assistant = createAssistant(options());
  open(assistant);
  expect(timeline().textContent).toContain('Send a message to start.');
  assistant.dispose();

  let release!: (value: { text: string; toolCalls: never[] }) => void;
  const generate = vi.fn(
    () =>
      new Promise<{ text: string; toolCalls: never[] }>((resolve) => {
        release = resolve;
      }),
  );
  const busy = createAssistant(options({ model: { generate } }));
  open(busy);
  submit('Hello');
  await vi.waitFor(() => {
    expect(timeline().textContent).toContain('The assistant is thinking…');
  });
  release({ text: 'Hi.', toolCalls: [] });
  await vi.waitFor(() => {
    expect(busy.getState().busy).toBe(false);
  });
  busy.dispose();

  const failing = createAssistant(
    options({
      model: {
        generate: async () => {
          throw new Error('upstream');
        },
      },
    }),
  );
  open(failing);
  submit('Hello');
  await vi.waitFor(() => {
    expect(timeline().textContent).toContain('The assistant could not complete the turn.');
  });
  failing.dispose();
});
