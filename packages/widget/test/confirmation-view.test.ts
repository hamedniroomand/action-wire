// @vitest-environment happy-dom

import type {
  AgentAdapter,
  AssistantOptions,
  ToolDefinition,
  ToolSource,
} from '@webmcp-agent/core';
import { afterEach, expect, it, vi } from 'vitest';

import { createAssistant } from '../src/index';

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('webmcp-assistant').forEach((node) => {
    node.remove();
  });
});

const remove: ToolDefinition = {
  id: 'delete',
  name: 'deleteProject',
  description: 'Delete a project',
  inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
  consequential: true,
};

function source(execute: ToolSource['execute']): ToolSource {
  return {
    discover: async () => ({ revision: 1, tools: [remove] }),
    execute,
    subscribe: () => () => {},
    dispose: () => {},
  };
}

function options(
  execute: ToolSource['execute'],
  generate: AgentAdapter['generate'],
): AssistantOptions {
  return { model: { generate }, source: source(execute) };
}

function shadow(): ShadowRoot {
  const host = document.querySelector('webmcp-assistant');
  if (host?.shadowRoot === null || host === null) throw new Error('missing widget');
  return host.shadowRoot;
}

function openPanel(assistant: ReturnType<typeof createAssistant>): void {
  assistant.mount();
  launcher().click();
}

function launcher(): HTMLButtonElement {
  const button = shadow().querySelector('button[aria-label="Open assistant"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error('missing launcher');
  return button;
}

function closeButton(): HTMLButtonElement {
  const button = shadow().querySelector('button[aria-label="Close assistant"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error('missing close');
  return button;
}

function submit(text: string): void {
  const field = shadow().querySelector('textarea');
  if (!(field instanceof HTMLTextAreaElement)) throw new Error('missing composer');
  field.value = text;
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
}

function action(label: string): HTMLButtonElement {
  const button = [...shadow().querySelectorAll('button')].find(
    (node) => node instanceof HTMLButtonElement && node.textContent === label,
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`missing ${label}`);
  return button;
}

function deleteTurn(): AgentAdapter['generate'] {
  return vi
    .fn<AgentAdapter['generate']>()
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [{ id: 'c1', toolId: 'delete', arguments: { name: 'Phoenix' } }],
    })
    .mockResolvedValueOnce({ text: 'Deleted Phoenix.', toolCalls: [] });
}

it('reaches Cancel and Delete with the keyboard', async () => {
  const assistant = createAssistant(options(vi.fn(), deleteTurn()));
  openPanel(assistant);
  submit('Delete Phoenix.');
  await vi.waitFor(() => {
    expect(action('Cancel').tabIndex).toBeGreaterThanOrEqual(0);
    expect(action('Delete').tabIndex).toBeGreaterThanOrEqual(0);
  });
  action('Cancel').focus();
  expect(shadow().activeElement).toBe(action('Cancel'));
  action('Delete').focus();
  expect(shadow().activeElement).toBe(action('Delete'));
  assistant.dispose();
});

it('restores focus to the launcher when the panel closes', () => {
  const assistant = createAssistant(options(vi.fn(), async () => ({ text: 'Hi.', toolCalls: [] })));
  openPanel(assistant);
  closeButton().focus();
  closeButton().click();
  expect(shadow().activeElement).toBe(launcher());
  assistant.dispose();
});

it('runs the native handler only after an explicit confirm click', async () => {
  const execute = vi.fn().mockResolvedValue({ callId: 'c1', ok: true, text: 'Deleted' });
  const assistant = createAssistant(options(execute, deleteTurn()));
  openPanel(assistant);
  const sending = assistant.send('Delete Phoenix.');
  await vi.waitFor(() => {
    expect(action('Delete')).toBeTruthy();
  });
  expect(execute).toHaveBeenCalledTimes(0);
  closeButton().click();
  expect(execute).toHaveBeenCalledTimes(0);
  expect(assistant.getState().confirmation?.id).toBe('c1');
  launcher().click();
  expect(action('Delete')).toBeTruthy();
  action('Delete').click();
  await sending;
  expect(execute).toHaveBeenCalledTimes(1);
  assistant.dispose();
});
