import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';

import {
  handleAssistantRequest,
  MAX_BODY_BYTES,
  type AssistantEnv,
  type FetchLike,
} from './assistant';

export function createAssistantServer(
  env: AssistantEnv = process.env,
  fetchImpl?: FetchLike,
): ReturnType<typeof createServer> {
  return createServer((request, response) => {
    void pipe(request, response, env, fetchImpl);
  });
}

async function pipe(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  env: AssistantEnv,
  fetchImpl: FetchLike | undefined,
): Promise<void> {
  try {
    const converted = await toRequest(incoming);
    if (converted === undefined) {
      outgoing.writeHead(413, { 'content-type': 'application/json' });
      outgoing.end(JSON.stringify({ error: { message: 'The request body is too large.' } }));
      return;
    }
    const response =
      fetchImpl === undefined
        ? await handleAssistantRequest(converted, env)
        : await handleAssistantRequest(converted, env, fetchImpl);
    outgoing.writeHead(response.status, {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    });
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { 'content-type': 'application/json' });
    outgoing.end(JSON.stringify({ error: { message: 'The assistant request failed.' } }));
  }
}

async function toRequest(incoming: IncomingMessage): Promise<Request | undefined> {
  const method = incoming.method ?? 'GET';
  const url = new URL(incoming.url ?? '/', 'http://127.0.0.1');
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
      continue;
    }
    if (typeof value === 'string') headers.set(name, value);
  }
  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers });
  }
  const body = await readBody(incoming);
  if (body === undefined) return undefined;
  return new Request(url, { method, headers, body });
}

async function readBody(incoming: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of incoming) {
    const piece = Buffer.from(chunk);
    size += piece.byteLength;
    if (size > MAX_BODY_BYTES) {
      incoming.destroy();
      return undefined;
    }
    chunks.push(piece);
  }
  return Buffer.concat(chunks);
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  const port = Number.parseInt(process.env['WEBMCP_AGENT_PORT'] ?? '8787', 10);
  createAssistantServer().listen(Number.isFinite(port) ? port : 8787, '127.0.0.1');
}
