export type AssistantEnv = {
  readonly ACTIONWIRE_UPSTREAM_URL?: string;
  readonly ACTIONWIRE_MODEL?: string;
  readonly ACTIONWIRE_API_KEY?: string;
};

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export const MAX_BODY_BYTES = 256 * 1024;
const MAX_TOOLS = 32;
const MAX_MESSAGES = 64;

export async function handleAssistantRequest(
  request: Request,
  env: AssistantEnv,
  fetchImpl: FetchLike = defaultFetch,
): Promise<Response> {
  if (request.method !== 'POST') {
    return fail(405, 'Use POST to call the assistant.');
  }
  if (new URL(request.url).pathname !== '/api/assistant') {
    return fail(404, 'This path is not available.');
  }
  const upstream = readSetting(env.ACTIONWIRE_UPSTREAM_URL);
  const model = readSetting(env.ACTIONWIRE_MODEL);
  const key = readSetting(env.ACTIONWIRE_API_KEY);
  if (upstream === undefined || model === undefined || key === undefined) {
    return fail(503, 'Set ACTIONWIRE_UPSTREAM_URL, ACTIONWIRE_MODEL, and ACTIONWIRE_API_KEY.');
  }
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader !== null) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      return fail(413, 'The request body is too large.');
    }
  }
  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) {
    return fail(413, 'The request body is too large.');
  }
  const payload = parseBody(new TextDecoder().decode(raw));
  if (payload === undefined) {
    return fail(400, 'The request body is invalid.');
  }
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchImpl(upstream, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: payload.messages,
        ...(payload.tools === undefined ? {} : { tools: payload.tools }),
      }),
      signal: request.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return fail(499, 'The model request was aborted.');
    }
    return fail(502, 'The model request failed.');
  }
  if (!upstreamResponse.ok) {
    return fail(upstreamResponse.status === 429 ? 429 : 502, 'The model request failed.');
  }
  const text = await upstreamResponse.text();
  try {
    JSON.parse(text);
  } catch {
    return fail(502, 'The model request failed.');
  }
  return new Response(text, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function defaultFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

function readSetting(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function parseBody(raw: string): { messages: unknown[]; tools?: unknown[] } | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || !Array.isArray(value['messages'])) return undefined;
  const messages = value['messages'];
  if (messages.length === 0 || messages.length > MAX_MESSAGES) return undefined;
  if (!messages.every(isRecord)) return undefined;
  const tools = value['tools'];
  if (tools === undefined) return { messages };
  if (!Array.isArray(tools) || tools.length > MAX_TOOLS || !tools.every(isRecord)) {
    return undefined;
  }
  return { messages, tools };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
}
