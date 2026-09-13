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

class FakeContext extends EventTarget {
  listenerCount = 0;
  tools: FakeTool[] = [];
  executeTool = async (_tool?: object, _input?: unknown) => '{"text":"ok"}';
  registerTool = async () => {};
  getTools = async () => this.tools;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    this.listenerCount += 1;
    super.addEventListener(type, listener, options);
  }
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    this.listenerCount -= 1;
    super.removeEventListener(type, listener, options);
  }
}

function echo(window: object, name = 'echo'): FakeTool {
  return {
    name,
    description: `${name} tool.`,
    origin: 'http://127.0.0.1:4173',
    window,
    inputSchema: JSON.stringify(schema),
    annotations: { readOnlyHint: true },
  };
}

function install(context: FakeContext, currentWindow: object) {
  Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: currentWindow, configurable: true });
  Object.defineProperty(globalThis, 'document', {
    value: { modelContext: context },
    configurable: true,
  });
}

afterEach(() => {
  for (const key of ['document', 'window', 'isSecureContext']) {
    Reflect.deleteProperty(globalThis, key);
  }
});

it('adds, removes, and replaces tools during a session', async () => {
  const currentWindow = {};
  const context = new FakeContext();
  context.tools = [echo(currentWindow)];
  install(context, currentWindow);
  const source = createWebMCPSource();
  const notifications: number[] = [];
  source.subscribe(() => {
    notifications.push(1);
  });
  expect((await source.discover()).tools.map((tool) => tool.name)).toEqual(['echo']);
  context.tools = [echo(currentWindow), echo(currentWindow, 'listProjects')];
  context.dispatchEvent(new Event('toolchange'));
  expect((await source.discover()).tools.map((tool) => tool.name)).toEqual([
    'echo',
    'listProjects',
  ]);
  context.tools = [echo(currentWindow, 'listProjects')];
  context.dispatchEvent(new Event('toolchange'));
  expect((await source.discover()).tools.map((tool) => tool.name)).toEqual(['listProjects']);
  const replacement = echo(currentWindow, 'listProjects');
  context.tools = [replacement];
  context.dispatchEvent(new Event('toolchange'));
  expect((await source.discover()).tools.map((tool) => tool.name)).toEqual(['listProjects']);
  expect(notifications.length).toBeGreaterThan(0);
  source.dispose();
});

it('does not reuse authority when a name is registered again', async () => {
  const currentWindow = {};
  const context = new FakeContext();
  const first = echo(currentWindow);
  context.tools = [first];
  const seen: object[] = [];
  context.executeTool = async (_tool?: object) => {
    if (_tool !== undefined) seen.push(_tool);
    return '{"text":"ok"}';
  };
  install(context, currentWindow);
  const source = createWebMCPSource();
  const firstSnapshot = await source.discover();
  const second = echo(currentWindow);
  context.tools = [second];
  const nextSnapshot = await source.discover();
  expect(nextSnapshot.revision).toBeGreaterThan(firstSnapshot.revision);
  const stale = await source.execute(
    { id: 'c1', toolId: 'echo', arguments: { text: 'Phoenix' } },
    firstSnapshot.revision,
  );
  expect(stale).toMatchObject({ ok: false, code: 'STALE_TOOLS' });
  expect(seen).toEqual([]);
  const fresh = await source.execute(
    { id: 'c1', toolId: 'echo', arguments: { text: 'Phoenix' } },
    nextSnapshot.revision,
  );
  expect(fresh.ok).toBe(true);
  expect(seen).toEqual([second]);
  source.dispose();
});

it('keeps the latest tools when refreshes complete out of order', async () => {
  const currentWindow = {};
  const context = new FakeContext();
  const firstTools = [echo(currentWindow)];
  const secondTools = [echo(currentWindow, 'listProjects')];
  context.tools = firstTools;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  let firstStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    firstStarted = resolve;
  });
  context.getTools = async () => {
    const id = (calls += 1);
    if (id === 1) {
      firstStarted();
      await blocked;
      return firstTools;
    }
    return secondTools;
  };
  install(context, currentWindow);
  const source = createWebMCPSource();
  const first = source.discover();
  await started;
  context.tools = secondTools;
  const second = await source.discover();
  release();
  const late = await first;
  expect(second.tools.map((tool) => tool.name)).toEqual(['listProjects']);
  expect(late.tools.map((tool) => tool.name)).toEqual(['listProjects']);
  source.dispose();
});

it('leaves zero active listeners after disposal', async () => {
  const currentWindow = {};
  const context = new FakeContext();
  context.tools = [echo(currentWindow)];
  install(context, currentWindow);
  const source = createWebMCPSource();
  let notifications = 0;
  source.subscribe(() => {
    notifications += 1;
  });
  await source.discover();
  expect(context.listenerCount).toBeGreaterThan(0);
  const before = notifications;
  source.dispose();
  context.dispatchEvent(new Event('toolchange'));
  expect(context.listenerCount).toBe(0);
  expect(notifications).toBe(before);
});
