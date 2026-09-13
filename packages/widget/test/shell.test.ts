// @vitest-environment happy-dom

import type { AgentAdapter, AssistantOptions, ToolSource } from '@action-wire/core';
import { afterEach, expect, it, vi } from 'vitest';

import { createAssistant } from '../src/index';

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

function options(overrides: Partial<AssistantOptions> = {}): AssistantOptions {
  return { model: model(), source: source(), ...overrides };
}

function shadow(): ShadowRoot {
  const host = document.querySelector('action-wire');
  if (host?.shadowRoot === null || host === null) throw new Error('missing widget');
  return host.shadowRoot;
}

function launcher(): HTMLButtonElement {
  const button = shadow().querySelector('button[aria-label="Open assistant"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error('missing launcher');
  return button;
}

function panel(): HTMLElement {
  const dialog = shadow().querySelector('[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) throw new Error('missing panel');
  return dialog;
}

function closeButton(): HTMLButtonElement {
  const button = shadow().querySelector('button[aria-label="Close assistant"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error('missing close');
  return button;
}

function composer(): HTMLTextAreaElement {
  const field = shadow().querySelector('textarea');
  if (!(field instanceof HTMLTextAreaElement)) throw new Error('missing composer');
  return field;
}

function sendButton(): HTMLButtonElement {
  const button = shadow().querySelector('button[aria-label="Send"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error('missing send');
  return button;
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

it('opens and closes with pointer and keyboard', () => {
  const assistant = createAssistant(options());
  assistant.mount();
  expect(panel().hidden).toBe(true);
  launcher().click();
  expect(panel().hidden).toBe(false);
  closeButton().click();
  expect(panel().hidden).toBe(true);
  press(launcher(), 'Enter');
  expect(panel().hidden).toBe(false);
  press(panel(), 'Escape');
  expect(panel().hidden).toBe(true);
  assistant.dispose();
});

it('does not submit whitespace', async () => {
  const generate = vi.fn().mockResolvedValue({ text: 'Hi.', toolCalls: [] });
  const assistant = createAssistant(options({ model: { generate } }));
  assistant.mount();
  launcher().click();
  composer().value = '   \n\t';
  press(composer(), 'Enter');
  sendButton().click();
  await Promise.resolve();
  expect(generate).not.toHaveBeenCalled();
  assistant.dispose();
});

it('does not submit while IME composition is active', async () => {
  const generate = vi.fn().mockResolvedValue({ text: 'Hi.', toolCalls: [] });
  const assistant = createAssistant(options({ model: { generate } }));
  assistant.mount();
  launcher().click();
  const field = composer();
  field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  field.value = '你';
  press(field, 'Enter', { isComposing: true });
  await Promise.resolve();
  expect(generate).not.toHaveBeenCalled();
  assistant.dispose();
});

it('submits typed text once', async () => {
  let release!: (value: { text: string; toolCalls: never[] }) => void;
  const generate = vi.fn(
    () =>
      new Promise<{ text: string; toolCalls: never[] }>((resolve) => {
        release = resolve;
      }),
  );
  const assistant = createAssistant(options({ model: { generate } }));
  assistant.mount();
  launcher().click();
  composer().value = 'Hello';
  press(composer(), 'Enter');
  press(composer(), 'Enter');
  sendButton().click();
  await vi.waitFor(() => {
    expect(generate).toHaveBeenCalledTimes(1);
  });
  release({ text: 'Hi.', toolCalls: [] });
  await vi.waitFor(() => {
    expect(assistant.getState().busy).toBe(false);
  });
  assistant.dispose();
});

it('shows busy feedback immediately', async () => {
  let release!: (value: { text: string; toolCalls: never[] }) => void;
  const generate = vi.fn(
    () =>
      new Promise<{ text: string; toolCalls: never[] }>((resolve) => {
        release = resolve;
      }),
  );
  const assistant = createAssistant(options({ model: { generate } }));
  assistant.mount();
  launcher().click();
  composer().value = 'Hello';
  press(composer(), 'Enter');
  await vi.waitFor(() => {
    expect(panel().getAttribute('aria-busy')).toBe('true');
    expect(sendButton().disabled).toBe(true);
  });
  release({ text: 'Hi.', toolCalls: [] });
  await vi.waitFor(() => {
    expect(panel().getAttribute('aria-busy')).toBe('false');
  });
  assistant.dispose();
});
