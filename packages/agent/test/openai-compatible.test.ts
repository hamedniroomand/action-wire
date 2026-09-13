import { AgentError } from '@webmcp-agent/core';
import type { Message, ToolDefinition } from '@webmcp-agent/core';
import { afterEach, expect, it, vi } from 'vitest';

import { openAICompatible } from '~/index';

const tools: ToolDefinition[] = [
  {
    id: 'list',
    name: 'listProjects',
    description: 'List projects',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    id: 'open',
    name: 'openProject',
    description: 'Open a project',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

it('keeps multi-tool response IDs and round-trips tool result messages', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse(200, {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call_list',
                type: 'function',
                function: { name: 'listProjects', arguments: '{}' },
              },
              {
                id: 'call_open',
                type: 'function',
                function: { name: 'openProject', arguments: '{"name":"Phoenix"}' },
              },
            ],
          },
        },
      ],
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const model = openAICompatible({ endpoint: 'http://127.0.0.1:8787/api/assistant' });
  const messages: Message[] = [
    { role: 'user', content: 'Open the latest project.' },
    {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call_list', toolId: 'list', arguments: {} }],
    },
    { role: 'tool', content: 'Phoenix', callId: 'call_list' },
  ];
  const turn = await model.generate({ messages, tools });
  expect(turn).toEqual({
    text: '',
    toolCalls: [
      { id: 'call_list', toolId: 'list', arguments: {} },
      { id: 'call_open', toolId: 'open', arguments: { name: 'Phoenix' } },
    ],
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const url = fetchMock.mock.calls[0]?.[0];
  const init = fetchMock.mock.calls[0]?.[1];
  expect(url).toBe('http://127.0.0.1:8787/api/assistant');
  expect(init).toEqual(expect.objectContaining({ method: 'POST' }));
  const headers = new Headers(init?.headers);
  expect(headers.get('authorization')).toBeNull();
  expect(headers.has('x-api-key')).toBe(false);
  expect(typeof init?.body).toBe('string');
  const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '');
  expect(body).toEqual({
    messages: [
      { role: 'user', content: 'Open the latest project.' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_list',
            type: 'function',
            function: { name: 'listProjects', arguments: '{}' },
          },
        ],
      },
      { role: 'tool', content: 'Phoenix', tool_call_id: 'call_list' },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'listProjects',
          description: 'List projects',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'openProject',
          description: 'Open a project',
          parameters: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    ],
  });
});

it.each([
  ['invalid JSON', jsonResponse(200, '{'), 'MODEL_ERROR'],
  [
    'an unknown tool name',
    jsonResponse(200, {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'c1',
                type: 'function',
                function: { name: 'missingTool', arguments: '{}' },
              },
            ],
          },
        },
      ],
    }),
    'MODEL_ERROR',
  ],
  ['401', jsonResponse(401, { error: { message: 'unauthorized' } }), 'MODEL_ERROR'],
  ['429', jsonResponse(429, { error: { message: 'rate limit' } }), 'MODEL_ERROR'],
  ['500', jsonResponse(500, { error: { message: 'upstream' } }), 'MODEL_ERROR'],
])('maps %s to MODEL_ERROR', async (_name, response, code) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  const model = openAICompatible({ endpoint: 'http://127.0.0.1:8787/api/assistant' });
  await expect(
    model.generate({ messages: [{ role: 'user', content: 'Hi' }], tools }),
  ).rejects.toBeInstanceOf(AgentError);
  await expect(
    model.generate({ messages: [{ role: 'user', content: 'Hi' }], tools }),
  ).rejects.toMatchObject({
    code,
  });
});
