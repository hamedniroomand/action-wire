type RegisteredTool = {
  name: string;
  description: string;
  inputSchema?: object | string;
  annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean };
  window: Window;
  origin: string;
};

type NativeModelContext = EventTarget & {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; consequentialHint: boolean };
      execute: (input: { text: string }) => Promise<{ text: string }>;
    },
    options: { signal: AbortSignal },
  ): Promise<void>;
  getTools(): Promise<RegisteredTool[]>;
  executeTool(
    tool: RegisteredTool,
    input: { text: string } | string,
    options: { signal: AbortSignal },
  ): Promise<string>;
};

export type ProbeReport = {
  status: 'supported' | 'unsupported' | 'failed';
  message: string;
  userAgent: string;
  secureContext: boolean;
  origin: string;
  api: Record<string, string>;
  handlerCalls: number;
  registeredBeforeDiscovery?: boolean;
  registrationEvent?: boolean;
  removalEvent?: boolean;
  removedAfterAbort?: boolean;
  tool?: {
    name: string;
    description: string;
    inputSchema?: object | string;
    annotations?: object;
    origin: string;
    currentWindow: boolean;
  };
  inputEncoding?: 'object' | 'json-string';
  rawResult?: string;
  result?: unknown;
};

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('The WebMCP operation timed out.'));
        }, 1500);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runProbe(): Promise<ProbeReport> {
  const context = (document as Document & { modelContext?: NativeModelContext }).modelContext;
  const methods = [
    'registerTool',
    'getTools',
    'executeTool',
    'addEventListener',
    'removeEventListener',
  ] as const;
  const report: ProbeReport = {
    status: 'unsupported',
    message: 'This browser does not expose the required document.modelContext WebMCP API.',
    userAgent: navigator.userAgent,
    secureContext: isSecureContext,
    origin: location.origin,
    api: Object.fromEntries(methods.map((key) => [key, typeof context?.[key]])),
    handlerCalls: 0,
  };
  if (!isSecureContext || !context || methods.some((key) => typeof context[key] !== 'function'))
    return report;

  const registration = new AbortController();
  const execution = new AbortController();
  const name = `webmcp_probe_${crypto.randomUUID().replaceAll('-', '')}`;
  let changes = 0;
  const onChange = () => {
    changes += 1;
  };
  context.addEventListener('toolchange', onChange);
  try {
    await bounded(
      context.registerTool(
        {
          name,
          description: 'Return the probe text.',
          inputSchema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, consequentialHint: false },
          execute: async (input) => {
            report.handlerCalls += 1;
            return { text: input.text };
          },
        },
        { signal: registration.signal },
      ),
    );
    report.registeredBeforeDiscovery = true;
    const tools = await bounded(context.getTools());
    const tool = tools.find((entry) => entry.name === name && entry.window === window);
    if (!tool)
      throw new Error('WebMCP did not discover the registered tool in the current document.');
    report.registrationEvent = changes > 0;
    report.tool = {
      name: tool.name,
      description: tool.description,
      origin: tool.origin,
      currentWindow: tool.window === window,
      ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
      ...(tool.annotations === undefined ? {} : { annotations: tool.annotations }),
    };
    report.inputEncoding = typeof tool.inputSchema === 'string' ? 'json-string' : 'object';
    const input = { text: 'WebMCP probe' };
    report.rawResult = await bounded(
      context.executeTool(
        tool,
        report.inputEncoding === 'json-string' ? JSON.stringify(input) : input,
        { signal: execution.signal },
      ),
    );
    report.result = JSON.parse(report.rawResult);
    if (
      JSON.stringify(report.result) !== JSON.stringify({ text: 'WebMCP probe' }) ||
      report.handlerCalls !== 1
    ) {
      throw new Error('WebMCP did not return the echo result from one handler call.');
    }
    const beforeRemoval = changes;
    registration.abort();
    report.removedAfterAbort = !(await bounded(context.getTools())).some(
      (entry) => entry.name === name,
    );
    report.removalEvent = changes > beforeRemoval;
    if (!report.removedAfterAbort) throw new Error('WebMCP did not remove the tool after abort.');
    report.status = 'supported';
    report.message = 'Native WebMCP discovery and execution passed.';
  } catch (error) {
    report.status = 'failed';
    report.message = error instanceof Error ? error.message : String(error);
  } finally {
    registration.abort();
    execution.abort();
    context.removeEventListener('toolchange', onChange);
  }
  return report;
}
