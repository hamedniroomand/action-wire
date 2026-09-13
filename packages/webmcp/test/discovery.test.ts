import { AgentError } from '@webmcp-agent/core';
import { afterEach, expect, it } from 'vitest';

import { createWebMCPSource } from '~/index';

type FakeTool = {
  name: string;
  description: string;
  inputSchema?: object | string;
  annotations?: Record<string, boolean>;
  window: object;
  origin: string;
};

const schema = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
  additionalProperties: false,
};

function installNative(
  tools: FakeTool[] | ((currentWindow: object) => FakeTool[]),
  extra?: Record<string, unknown>,
) {
  const currentWindow = {};
  const context = {
    registerTool: async () => {},
    getTools: async () => (typeof tools === 'function' ? tools(currentWindow) : tools),
    executeTool: async () => '{"text":""}',
    addEventListener() {},
    removeEventListener() {},
    ...extra,
  };
  Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: currentWindow, configurable: true });
  Object.defineProperty(globalThis, 'document', {
    value: { modelContext: context },
    configurable: true,
  });
  return { currentWindow, context };
}

afterEach(() => {
  for (const key of ['document', 'window', 'isSecureContext']) {
    Reflect.deleteProperty(globalThis, key);
  }
});

it('discovers tools registered before mount', async () => {
  const { context } = installNative((window) => [
    {
      name: 'echo',
      description: 'Return the probe text.',
      origin: 'http://127.0.0.1:4173',
      window,
      inputSchema: JSON.stringify(schema),
      annotations: { readOnlyHint: true, untrustedContentHint: false },
    },
  ]);
  const registerTool = context.registerTool;
  const source = createWebMCPSource();
  const snapshot = await source.discover();
  expect(context.registerTool).toBe(registerTool);
  expect(snapshot.tools).toEqual([
    {
      id: 'echo',
      name: 'echo',
      description: 'Return the probe text.',
      inputSchema: schema,
      readOnly: true,
    },
  ]);
  source.dispose();
});

it('keeps native schemas through normalization without loss', async () => {
  const nativeSchema = {
    type: 'object',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    properties: {
      name: { type: 'string', minLength: 1 },
      count: { type: 'integer', minimum: 0 },
    },
    required: ['name'],
    additionalProperties: false,
  };
  installNative((window) => [
    {
      name: 'listProjects',
      description: 'List projects.',
      origin: 'http://127.0.0.1:4173',
      window,
      inputSchema: JSON.stringify(nativeSchema),
      annotations: { consequentialHint: true },
    },
  ]);
  const source = createWebMCPSource();
  const snapshot = await source.discover();
  expect(snapshot.tools[0]?.inputSchema).toEqual(nativeSchema);
  expect(snapshot.tools[0]?.consequential).toBe(true);
  expect(snapshot.tools[0]?.readOnly).toBeUndefined();
  source.dispose();
});

it('fails when current-document names are duplicated', async () => {
  const otherWindow = {};
  installNative((window) => [
    {
      name: 'echo',
      description: 'First.',
      origin: 'http://127.0.0.1:4173',
      window,
      inputSchema: JSON.stringify(schema),
    },
    {
      name: 'echo',
      description: 'Second.',
      origin: 'http://127.0.0.1:4173',
      window,
      inputSchema: JSON.stringify(schema),
    },
    {
      name: 'echo',
      description: 'Other frame.',
      origin: 'http://127.0.0.1:4173',
      window: otherWindow,
      inputSchema: JSON.stringify(schema),
    },
  ]);
  const source = createWebMCPSource();
  await expect(source.discover()).rejects.toMatchObject({
    name: 'AgentError',
    code: 'INVALID_SCHEMA',
  });
  source.dispose();
});

it('returns an empty snapshot when no current-document tools exist', async () => {
  const otherWindow = {};
  installNative((window) => {
    void window;
    return [
      {
        name: 'echo',
        description: 'Other frame.',
        origin: 'http://127.0.0.1:4173',
        window: otherWindow,
        inputSchema: JSON.stringify(schema),
      },
    ];
  });
  const source = createWebMCPSource();
  await expect(source.discover()).resolves.toEqual({ revision: 0, tools: [] });
  source.dispose();
});

it('reports UNSUPPORTED_WEBMCP when the required API is absent', async () => {
  Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: {}, configurable: true });
  const source = createWebMCPSource();
  await expect(source.discover()).rejects.toBeInstanceOf(AgentError);
  await expect(source.discover()).rejects.toMatchObject({ code: 'UNSUPPORTED_WEBMCP' });
  source.dispose();
});
