// @vitest-environment happy-dom

import type { AgentAdapter, AssistantOptions, ToolSource } from '@webmcp-agent/core';
import { afterEach, expect, it, vi } from 'vitest';

import { createAssistant } from '../src/index';

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('webmcp-assistant').forEach((node) => {
    node.remove();
  });
});

function source(stop: () => void = () => {}): ToolSource {
  return {
    discover: async () => ({ revision: 1, tools: [] }),
    execute: async (call) => ({ callId: call.id, ok: true, text: '' }),
    subscribe: () => stop,
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

it('creates one widget from two mounts', () => {
  const assistant = createAssistant(options());
  assistant.mount();
  assistant.mount();
  expect(document.querySelectorAll('webmcp-assistant')).toHaveLength(1);
  assistant.dispose();
});

it('detaches the UI on unmount', () => {
  const assistant = createAssistant(options());
  assistant.mount();
  assistant.unmount();
  expect(document.querySelector('webmcp-assistant')).toBeNull();
  assistant.dispose();
});

it('preserves the session after remount', async () => {
  const assistant = createAssistant(options());
  assistant.mount();
  await assistant.send('Hello');
  assistant.unmount();
  assistant.mount();
  expect(assistant.getState().messages).toContainEqual({ role: 'user', content: 'Hello' });
  expect(document.querySelectorAll('webmcp-assistant')).toHaveLength(1);
  assistant.dispose();
});

it('cancels work and releases resources on dispose', async () => {
  const stop = vi.fn();
  const generate = vi.fn(({ signal }: { signal?: AbortSignal }) => {
    return new Promise<never>((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(signal.reason);
      });
    });
  });
  const assistant = createAssistant({
    model: { generate },
    source: source(stop),
  });
  assistant.mount();
  const sending = assistant.send('Hello');
  await vi.waitFor(() => {
    expect(generate).toHaveBeenCalled();
  });
  assistant.dispose();
  await sending;
  expect(document.querySelector('webmcp-assistant')).toBeNull();
  expect(stop).toHaveBeenCalled();
  expect(generate.mock.calls[0]?.[0].signal?.aborted).toBe(true);
});

it('does not access document when the package is imported in Node', async () => {
  vi.resetModules();
  const access = vi.fn();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    get() {
      access();
      return descriptor?.get === undefined ? descriptor?.value : descriptor.get.call(globalThis);
    },
  });
  try {
    await import('../src/index');
    expect(access).not.toHaveBeenCalled();
  } finally {
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, 'document');
    else Object.defineProperty(globalThis, 'document', descriptor);
  }
});
