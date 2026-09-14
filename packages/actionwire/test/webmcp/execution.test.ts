import { afterEach, expect, it } from 'vitest';

import { createWebMCPSource } from '~/webmcp';

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

type ExecuteTool = (
  tool: object,
  input: unknown,
  options?: { signal: AbortSignal },
) => Promise<unknown>;

function installNative(
  tools: FakeTool[] | ((currentWindow: object) => FakeTool[]),
  extra?: { executeTool?: ExecuteTool },
) {
  const currentWindow = {};
  const context = {
    registerTool: async () => {},
    getTools: async () => (typeof tools === 'function' ? tools(currentWindow) : tools),
    executeTool: async (_tool: object, _input: unknown) => '{"text":""}',
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

async function mountEcho(executeTool: ExecuteTool) {
  let native: FakeTool | undefined;
  const { context } = installNative((window) => {
    native = {
      name: 'echo',
      description: 'Return input text.',
      origin: 'http://127.0.0.1:4173',
      window,
      inputSchema: JSON.stringify(schema),
      annotations: { readOnlyHint: true },
    };
    return [native];
  });
  context.executeTool = executeTool;
  const source = createWebMCPSource();
  const snapshot = await source.discover();
  return { source, snapshot, native, context };
}

it('runs the original app handler once', async () => {
  const received: unknown[] = [];
  const { source, snapshot, native } = await mountEcho(async (tool, input) => {
    received.push({ tool, input });
    return JSON.stringify({ text: 'Phoenix' });
  });
  const result = await source.execute(
    { id: 'c1', toolId: 'echo', arguments: { text: 'Phoenix' } },
    snapshot.revision,
  );
  expect(received).toEqual([{ tool: native, input: '{"text":"Phoenix"}' }]);
  expect(result).toEqual({
    callId: 'c1',
    ok: true,
    text: 'Phoenix',
    data: { text: 'Phoenix' },
  });
  source.dispose();
});

it.each([
  [
    'invalid arguments',
    { id: 'c1', toolId: 'echo', arguments: { text: 4 } },
    (revision: number) => revision,
    'INVALID_ARGUMENTS',
  ],
  [
    'a missing handle',
    { id: 'c1', toolId: 'missing', arguments: { text: 'Phoenix' } },
    (revision: number) => revision,
    'TOOL_UNAVAILABLE',
  ],
  [
    'a stale revision',
    { id: 'c1', toolId: 'echo', arguments: { text: 'Phoenix' } },
    (revision: number) => revision - 1,
    'STALE_TOOLS',
  ],
])('does not invoke the handler for %s', async (_name, call, revisionOf, code) => {
  const received: unknown[] = [];
  const { source, snapshot } = await mountEcho(async (_tool, input) => {
    received.push(input);
    return '{"text":"Phoenix"}';
  });
  const result = await source.execute(call, revisionOf(snapshot.revision));
  expect(received).toEqual([]);
  expect(result).toMatchObject({ callId: 'c1', ok: false, code });
  source.dispose();
});

it.each([
  [
    'rejection',
    async () => {
      throw new Error('The application handler failed.');
    },
    undefined,
    'EXECUTION_FAILED',
    ['{"text":"Phoenix"}'],
  ],
  [
    'a malformed result',
    async () => '{not-json',
    undefined,
    'EXECUTION_FAILED',
    ['{"text":"Phoenix"}'],
  ],
  ['abort', async () => '{"text":"Phoenix"}', AbortSignal.abort(), 'ABORTED', []],
])(
  'converts %s into a stable error',
  async (_name, executeTool, signal, code, expectedReceived) => {
    const received: unknown[] = [];
    const { source, snapshot } = await mountEcho(async (_tool, input) => {
      received.push(input);
      return executeTool();
    });
    const result =
      signal === undefined
        ? await source.execute(
            { id: 'c1', toolId: 'echo', arguments: { text: 'Phoenix' } },
            snapshot.revision,
          )
        : await source.execute(
            { id: 'c1', toolId: 'echo', arguments: { text: 'Phoenix' } },
            snapshot.revision,
            signal,
          );
    expect(received).toEqual(expectedReceived);
    expect(result).toMatchObject({ callId: 'c1', ok: false, code });
    source.dispose();
  },
);
