import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, expect, it, vi } from 'vitest';

import { handleAssistantRequest } from './assistant';
import { createAssistantServer } from './index';

const here = dirname(fileURLToPath(import.meta.url));
const env = {
  ACTIONWIRE_UPSTREAM_URL: 'https://example.test/v1/chat/completions',
  ACTIONWIRE_MODEL: 'demo-model',
  ACTIONWIRE_API_KEY: 'server-secret',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function post(body: string, contentType = 'application/json'): Request {
  return new Request('http://127.0.0.1:8787/api/assistant', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}

it('returns an actionable error when credentials are missing', async () => {
  const response = await handleAssistantRequest(
    post(JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] })),
    {},
  );
  expect(response.ok).toBe(false);
  const text = await response.text();
  expect(text).toContain('ACTIONWIRE_UPSTREAM_URL');
  expect(text).toContain('ACTIONWIRE_MODEL');
  expect(text).toContain('ACTIONWIRE_API_KEY');
});

it('rejects a malformed or oversized body', async () => {
  const malformed = await handleAssistantRequest(post('{'), env);
  expect(malformed.status).toBe(400);
  const missingMessages = await handleAssistantRequest(post('{}'), env);
  expect(missingMessages.status).toBe(400);
  const oversized = await handleAssistantRequest(
    post(`{"messages":[{"role":"user","content":"${'a'.repeat(300_000)}"}]}`),
    env,
  );
  expect(oversized.status).toBe(413);
  const tools = Array.from({ length: 33 }, (_, index) => ({
    type: 'function',
    function: { name: `tool_${index}`, parameters: { type: 'object' } },
  }));
  const tooMany = await handleAssistantRequest(
    post(JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }], tools })),
    env,
  );
  expect(tooMany.status).toBe(400);
});

it('sanitizes upstream errors and does not run a server tool handler', async () => {
  const executeTool = vi.fn();
  vi.stubGlobal('executeTool', executeTool);
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: { message: 'Invalid API key sk-secret-test-value' } }), {
      status: 401,
    }),
  );
  const response = await handleAssistantRequest(
    post(
      JSON.stringify({
        messages: [{ role: 'user', content: 'Delete Phoenix.' }],
        tools: [
          {
            type: 'function',
            function: { name: 'deleteProject', parameters: { type: 'object' } },
          },
        ],
      }),
    ),
    env,
    fetchMock,
  );
  const text = await response.text();
  expect(response.ok).toBe(false);
  expect(text).not.toContain('sk-secret-test-value');
  expect(text).not.toContain('server-secret');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const init = fetchMock.mock.calls[0]?.[1];
  expect(init).toMatchObject({
    method: 'POST',
    headers: expect.objectContaining({
      authorization: 'Bearer server-secret',
    }),
  });
  expect(JSON.parse(String(init?.body))).toMatchObject({
    model: 'demo-model',
    messages: [{ role: 'user', content: 'Delete Phoenix.' }],
  });
  expect(executeTool).not.toHaveBeenCalled();
});

it('binds the demo server to loopback', async () => {
  const server = createAssistantServer(env, vi.fn());
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  expect(address).not.toBeNull();
  if (typeof address === 'object' && address !== null) {
    expect(address.address).toBe('127.0.0.1');
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
});

it('keeps provider secrets out of the browser adapter', () => {
  const agentRoot = join(here, '../../packages/actionwire/src/agent');
  const files = readdirSync(agentRoot).filter((name) => name.endsWith('.ts'));
  expect(files.length).toBeGreaterThan(0);
  for (const name of files) {
    const source = readFileSync(join(agentRoot, name), 'utf8');
    expect(source).not.toMatch(/Authorization/i);
    expect(source).not.toMatch(/api[_-]?key/i);
    expect(source).not.toMatch(/ACTIONWIRE_API_KEY/);
    expect(source).not.toMatch(/process\.env/);
  }
});
