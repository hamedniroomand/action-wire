import { afterEach, expect, it, vi } from 'vitest';

import { openAICompatible } from '~/agent';
import { AgentError } from '~/core';
import type { Message, ToolDefinition } from '~/core';

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

it('accepts Qwen-style tool calls with reasoning metadata and empty arguments', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              reasoning_content: 'Plan: list projects first.',
              content: '',
              tool_calls: [
                {
                  id: 'call_d0880eded2584e7692dad31a',
                  type: 'function',
                  index: 0,
                  function: { name: 'listProjects', arguments: '{}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        model: 'qwen3.8-flash-free',
      }),
    ),
  );
  const model = openAICompatible({ endpoint: '/api/assistant' });
  const turn = await model.generate({
    messages: [{ role: 'user', content: 'Open project nova.' }],
    tools,
  });
  expect(turn.toolCalls).toEqual([
    { id: 'call_d0880eded2584e7692dad31a', toolId: 'list', arguments: {} },
  ]);
});

it('accepts missing tool arguments as an empty object', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, {
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: { name: 'listProjects' },
                },
              ],
            },
          },
        ],
      }),
    ),
  );
  const model = openAICompatible({ endpoint: '/api/assistant' });
  const turn = await model.generate({
    messages: [{ role: 'user', content: 'List' }],
    tools,
  });
  expect(turn.toolCalls[0]?.arguments).toEqual({});
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
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => response.clone()),
  );
  const model = openAICompatible({ endpoint: 'http://127.0.0.1:8787/api/assistant' });
  await expect(
    model.generate({ messages: [{ role: 'user', content: 'Hi' }], tools }),
  ).rejects.toMatchObject({ code });
});

it('replays a removed tool under the alias the provider first saw', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementation(() => jsonResponse(200, { choices: [{ message: { content: 'done' } }] }));
  vi.stubGlobal('fetch', fetchMock);
  const adapter = openAICompatible({ endpoint: '/api/assistant' });
  await adapter.generate({ messages: [{ role: 'user', content: 'open it' }], tools });
  const history: Message[] = [
    { role: 'user', content: 'open it' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', toolId: 'open', arguments: {} }] },
    { role: 'tool', content: 'Opened', callId: 'c1' },
  ];
  await adapter.generate({ messages: history, tools: [tools[0]!] });
  const second = fetchMock.mock.calls[1]?.[1];
  expect(second).toEqual(expect.objectContaining({ body: expect.any(String) }));
  const parsed: unknown = JSON.parse(String(second?.body));
  const messages =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'messages') : undefined;
  const assistantMessage = Array.isArray(messages) ? messages[1] : undefined;
  const toolCalls =
    typeof assistantMessage === 'object' &&
    assistantMessage !== null &&
    Array.isArray(Reflect.get(assistantMessage, 'tool_calls'))
      ? Reflect.get(assistantMessage, 'tool_calls')
      : undefined;
  const firstCall =
    Array.isArray(toolCalls) && typeof toolCalls[0] === 'object' && toolCalls[0] !== null
      ? Reflect.get(toolCalls[0], 'function')
      : undefined;
  const name =
    typeof firstCall === 'object' && firstCall !== null
      ? Reflect.get(firstCall, 'name')
      : undefined;
  expect(name).toBe('openProject');
});

it('keeps reverse lookup scoped to each generate call', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse(200, {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'openProject', arguments: '{}' } },
            ],
          },
        },
      ],
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const adapter = openAICompatible({ endpoint: '/api/assistant' });
  await expect(
    adapter.generate({ messages: [{ role: 'user', content: 'Go' }], tools: [tools[0]!] }),
  ).rejects.toBeInstanceOf(AgentError);
});

it('logs response shape when debug is enabled and parsing fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, {
        choices: [{ message: { content: 42, tool_calls: 'not-an-array' } }],
      }),
    ),
  );
  const model = openAICompatible({
    endpoint: '/api/assistant',
    debug: true,
  });
  await expect(
    model.generate({ messages: [{ role: 'user', content: 'Hi' }], tools }),
  ).rejects.toMatchObject({ code: 'MODEL_ERROR' });
  expect(warn).toHaveBeenCalledWith(
    '[action-wire:model]',
    'parse',
    expect.objectContaining({
      shape: expect.objectContaining({ messageKeys: expect.any(Array) }),
      payload: expect.anything(),
    }),
  );
});
