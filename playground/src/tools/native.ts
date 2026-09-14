import type { ToolDeps, ToolSpec } from './spec';

export type NativeTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; consequentialHint: boolean };
  execute: (input: unknown) => Promise<{ text: string }>;
};

export type NativeContext = {
  registerTool(tool: NativeTool, options?: { signal: AbortSignal }): Promise<void>;
};

export function nativeContext(): NativeContext {
  const value = Reflect.get(document, 'modelContext');
  if (!isNativeContext(value)) throw new Error('This browser does not support WebMCP.');
  return value;
}

export async function registerTools(
  context: NativeContext,
  deps: ToolDeps,
  specs: readonly ToolSpec[],
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return;
  await Promise.all(
    specs.map((spec) => context.registerTool(toNativeTool(spec, deps), { signal })),
  );
}

function toNativeTool(spec: ToolSpec, deps: ToolDeps): NativeTool {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: {
      readOnlyHint: spec.readOnly === true,
      consequentialHint: spec.consequential === true,
    },
    execute: async (input) => spec.run(deps, asRecord(input)),
  };
}

function isNativeContext(value: unknown): value is NativeContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'registerTool') === 'function'
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    return asRecord(parsed);
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }
  return {};
}
