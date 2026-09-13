import type { ToolDefinition } from '@webmcp-agent/core';

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

const executed: string[] = [];
Object.defineProperty(globalThis, '__executed', {
  configurable: true,
  get: () => executed,
});

let nextCall = 0;

createAssistant({
  model: {
    async generate({ messages }) {
      if (messages.some((message) => message.role === 'tool')) {
        const last = messages.at(-1);
        return {
          text: last && 'content' in last ? last.content : 'Done.',
          toolCalls: [],
        };
      }
      let text = '';
      for (const message of messages) {
        if (message.role === 'user') text = message.content;
      }
      if (/delete/i.test(text)) {
        nextCall += 1;
        return {
          text: '',
          toolCalls: [{ id: `c${nextCall}`, toolId: 'delete', arguments: { name: 'Phoenix' } }],
        };
      }
      if (/list/i.test(text)) {
        nextCall += 1;
        return { text: '', toolCalls: [{ id: `c${nextCall}`, toolId: 'list', arguments: {} }] };
      }
      return { text: `You said: ${text}`, toolCalls: [] };
    },
  },
  source: {
    discover: async () => ({ revision: 1, tools: [list, remove] }),
    async execute(call) {
      executed.push(call.id);
      if (call.toolId === 'list') {
        return { callId: call.id, ok: true, text: 'Phoenix, Orion, Nova, Atlas' };
      }
      return { callId: call.id, ok: true, text: 'Deleted' };
    },
    subscribe: () => () => {},
    dispose: () => {},
  },
}).mount();
