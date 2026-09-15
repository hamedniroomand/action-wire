// @vitest-environment happy-dom

import { afterEach, expect, it, vi } from 'vitest';

import type { AgentAdapter, AssistantOptions, ToolSource } from '~/core';
import { createAssistant } from '~/widget';

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('action-wire').forEach((node) => {
    node.remove();
  });
});

function source(): ToolSource {
  return {
    discover: async () => ({ revision: 1, tools: [] }),
    execute: async (call) => ({ callId: call.id, ok: true, text: '' }),
    subscribe: () => () => {},
    dispose: () => {},
  };
}
function model(
  generate: AgentAdapter['generate'] = async () => ({ text: 'Hi.', toolCalls: [] }),
): AgentAdapter {
  return { generate };
}
function options(over: Partial<AssistantOptions> = {}): AssistantOptions {
  return { model: model(), source: source(), ...over };
}
function shadow(): ShadowRoot {
  const host = document.querySelector('action-wire');
  if (host?.shadowRoot === null || host === null) throw new Error('missing widget');
  return host.shadowRoot;
}
function wire(): HTMLButtonElement {
  const node = shadow().querySelector('button[aria-label="Open assistant"]');
  if (!(node instanceof HTMLButtonElement)) throw new Error('missing wire');
  return node;
}
function input(): HTMLInputElement {
  const node = shadow().querySelector('input[aria-label="Message"]');
  if (!(node instanceof HTMLInputElement)) throw new Error('missing input');
  return node;
}
function bar(): HTMLElement {
  const node = shadow().querySelector('[role="dialog"]');
  if (!(node instanceof HTMLElement)) throw new Error('missing bar');
  return node;
}
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
function enter(field: HTMLInputElement): void {
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
}

it('mounts collapsed and opens on the wire click', () => {
  const assistant = createAssistant(options());
  assistant.mount();
  expect(wire().hidden).toBe(false);
  expect(bar().hidden).toBe(true);
  wire().click();
  expect(bar().hidden).toBe(false);
  expect(shadow().activeElement).toBe(input());
  assistant.dispose();
});

it('sends on Enter and shows a receipt, then returns to idle on typing', async () => {
  const assistant = createAssistant(options());
  assistant.mount();
  wire().click();
  input().value = 'hello';
  enter(input());
  await flush();
  await flush();
  expect(bar().dataset['mode']).toBe('receipt');
  expect(bar().textContent).toContain('Hi.');
  input().value = 'n';
  input().dispatchEvent(new Event('input', { bubbles: true }));
  expect(bar().dataset['mode']).toBe('idle');
  assistant.dispose();
});

it('runs a consequential tool only after the confirm click', async () => {
  const execute = vi.fn(async (call: { id: string }) => ({
    callId: call.id,
    ok: true,
    text: 'Deleted',
  }));
  const assistant = createAssistant(
    options({
      model: model(async ({ messages }) =>
        messages.some((m) => m.role === 'tool')
          ? { text: 'Done.', toolCalls: [] }
          : { text: '', toolCalls: [{ id: 'c1', toolId: 'delete', arguments: {} }] },
      ),
      source: {
        ...source(),
        discover: async () => ({
          revision: 1,
          tools: [
            {
              id: 'delete',
              name: 'deleteProject',
              description: 'Delete',
              inputSchema: { type: 'object' },
              consequential: true,
            },
          ],
        }),
        execute,
      },
    }),
  );
  assistant.mount();
  wire().click();
  input().value = 'delete it';
  enter(input());
  await flush();
  const panel = () => shadow().querySelector('.proposal-panel');
  await vi.waitFor(() => expect(panel()?.hasAttribute('hidden')).toBe(false));
  expect(execute).not.toHaveBeenCalled();
  const confirms = [...shadow().querySelectorAll('button')].filter(
    (b) => b.textContent === 'Confirm',
  );
  expect(confirms).toHaveLength(1);
  confirms[0]!.click();
  await flush();
  await flush();
  expect(execute).toHaveBeenCalledTimes(1);
  assistant.dispose();
});

it('collapses on Escape and returns focus to the wire', () => {
  const assistant = createAssistant(options());
  assistant.mount();
  wire().click();
  bar().dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
  expect(bar().hidden).toBe(true);
  expect(shadow().activeElement).toBe(wire());
  assistant.dispose();
});

it('toggles with the hotkey and stops listening after unmount', () => {
  const assistant = createAssistant(options());
  assistant.mount();
  const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const toggle = () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '/',
        metaKey: mac,
        ctrlKey: !mac,
        bubbles: true,
        cancelable: true,
      }),
    );
  toggle();
  expect(bar().hidden).toBe(false);
  toggle();
  expect(bar().hidden).toBe(true);
  assistant.unmount();
  expect(document.querySelector('action-wire')).toBeNull();
  const event = new KeyboardEvent('keydown', {
    key: '/',
    metaKey: mac,
    ctrlKey: !mac,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  // The widget's listener would have called preventDefault. After unmount nothing does.
  expect(event.defaultPrevented).toBe(false);
  assistant.dispose();
});

it('writes the theme to the host and updates it with setTheme', () => {
  const assistant = createAssistant(options({ theme: 'dark' }));
  assistant.mount();
  const host = document.querySelector('action-wire');
  if (!(host instanceof HTMLElement)) throw new Error('missing host');
  expect(host.dataset['theme']).toBe('dark');
  assistant.setTheme('light');
  expect(host.dataset['theme']).toBe('light');
  assistant.dispose();
});

it('defaults the theme to system', () => {
  const assistant = createAssistant(options());
  assistant.mount();
  const host = document.querySelector('action-wire');
  if (!(host instanceof HTMLElement)) throw new Error('missing host');
  expect(host.dataset['theme']).toBe('system');
  assistant.dispose();
});
