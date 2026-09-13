import type {
  AgentAdapter,
  AssistantOptions,
  Message,
  MountedAssistant,
  ToolDefinition,
  ToolSource,
} from '@action-wire/core';

import { createAssistant } from '../src/index';

const list: ToolDefinition = {
  id: 'list',
  name: 'listProjects',
  description: 'List projects',
  inputSchema: { type: 'object' },
  readOnly: true,
};

const remove: ToolDefinition = {
  id: 'delete',
  name: 'deleteProject',
  description: 'Delete a project',
  inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
  consequential: true,
};

const rename: ToolDefinition = {
  id: 'rename',
  name: 'renameProject',
  description: 'Rename a project',
  inputSchema: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
  },
  readOnly: true,
};

export function mountCase(name: string): void {
  switch (name) {
    case 'missing':
      mount({ model: replies('Hi.') });
      return;
    case 'empty':
      mount({
        model: calls('list'),
        source: source({ discover: async () => ({ revision: 1, tools: [] }) }),
      });
      return;
    case 'reject':
      mount({
        model: calls('list'),
        source: source({
          discover: async () => ({ revision: 1, tools: [list] }),
          execute: async (call) => ({
            callId: call.id,
            ok: false,
            code: 'EXECUTION_FAILED',
            text: 'The tool failed.',
          }),
        }),
      });
      return;
    case 'invalid':
      mount({
        model: calls('rename'),
        source: source({
          discover: async () => ({ revision: 1, tools: [rename] }),
          execute: async (call) => {
            if (typeof call.arguments['name'] !== 'string') {
              return {
                callId: call.id,
                ok: false,
                code: 'INVALID_ARGUMENTS',
                text: 'The tool arguments do not match the input schema.',
              };
            }
            return { callId: call.id, ok: true, text: 'Renamed' };
          },
        }),
      });
      return;
    case 'timeout':
      mount({
        model: { generate: ({ signal }) => hang(signal) },
        source: idle(),
        timeoutMs: 80,
      });
      return;
    case 'abort':
    case 'teardown':
      Reflect.set(globalThis, '__aborted', false);
      mount({
        model: { generate: ({ signal }) => hang(signal) },
        source: idle(),
      });
      return;
    case 'stale': {
      let revision = 1;
      const executed: string[] = [];
      Reflect.set(globalThis, '__executed', executed);
      Reflect.set(globalThis, '__bump', () => {
        revision += 1;
      });
      mount({
        model: calls('delete', { name: 'Phoenix' }),
        source: source({
          discover: async () => ({ revision, tools: [remove] }),
          execute: async (call) => {
            executed.push(call.id);
            return { callId: call.id, ok: true, text: 'Deleted' };
          },
        }),
      });
      return;
    }
    case 'navigate': {
      let tools: ToolDefinition[] = [list, remove];
      let revision = 1;
      const change: { emit: () => void } = { emit() {} };
      Reflect.set(globalThis, '__navigate', () => {
        tools = [list];
        revision += 1;
        change.emit();
      });
      mount({
        model: {
          async generate({ messages, tools: available }) {
            if (hasToolResult(messages)) return done(messages);
            const text = lastUser(messages);
            if (/delete/i.test(text)) {
              const toolId = available.some((tool) => tool.id === 'delete') ? 'delete' : 'gone';
              return {
                text: '',
                toolCalls: [{ id: 'c2', toolId, arguments: { name: 'Phoenix' } }],
              };
            }
            return { text: '', toolCalls: [{ id: 'c1', toolId: 'list', arguments: {} }] };
          },
        },
        source: source({
          discover: async () => ({ revision, tools }),
          execute: async (call) => ({
            callId: call.id,
            ok: true,
            text: call.toolId === 'list' ? 'Phoenix' : 'Deleted',
          }),
          subscribe: (listener) => {
            change.emit = listener;
            return () => {
              change.emit = () => {};
            };
          },
        }),
      });
      return;
    }
    default:
      throw new Error(`Unknown case: ${name}`);
  }
}

function mount(options: AssistantOptions): MountedAssistant {
  const assistant = createAssistant(options);
  Reflect.set(globalThis, '__assistant', assistant);
  assistant.mount();
  return assistant;
}

function idle(): ToolSource {
  return source({ discover: async () => ({ revision: 1, tools: [list] }) });
}

function source(input: {
  discover: ToolSource['discover'];
  execute?: ToolSource['execute'];
  subscribe?: ToolSource['subscribe'];
}): ToolSource {
  return {
    discover: input.discover,
    execute: input.execute ?? (async (call) => ({ callId: call.id, ok: true, text: 'ok' })),
    subscribe: input.subscribe ?? (() => () => {}),
    dispose: () => {},
  };
}

function replies(text: string): AgentAdapter {
  return { generate: async () => ({ text, toolCalls: [] }) };
}

function calls(toolId: string, args: Record<string, string> = {}): AgentAdapter {
  let next = 0;
  return {
    async generate({ messages }) {
      if (hasToolResult(messages)) return done(messages);
      next += 1;
      return { text: '', toolCalls: [{ id: `c${next}`, toolId, arguments: args }] };
    },
  };
}

function hang(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = (): void => {
      Reflect.set(globalThis, '__aborted', true);
      reject(signal?.reason ?? new Error('aborted'));
    };
    if (signal?.aborted) {
      fail();
      return;
    }
    signal?.addEventListener('abort', fail, { once: true });
  });
}

function hasToolResult(messages: readonly Message[]): boolean {
  return messages.at(-1)?.role === 'tool';
}

function done(messages: readonly Message[]): { text: string; toolCalls: never[] } {
  const last = messages.at(-1);
  return {
    text: last !== undefined && 'content' in last ? last.content : 'Done.',
    toolCalls: [],
  };
}

function lastUser(messages: readonly Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') return message.content;
  }
  return '';
}
