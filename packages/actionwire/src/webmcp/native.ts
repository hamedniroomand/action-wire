import { AgentError } from '~/core';

export type NativeRegisteredTool = object;

export type NativeModelContext = EventTarget & {
  registerTool(tool: unknown, options?: { signal: AbortSignal }): Promise<void>;
  getTools(): Promise<unknown>;
  executeTool(
    tool: NativeRegisteredTool,
    input: string | Record<string, unknown>,
    options?: { signal: AbortSignal },
  ): Promise<unknown>;
};

const METHODS = [
  'registerTool',
  'getTools',
  'executeTool',
  'addEventListener',
  'removeEventListener',
] as const;

function unsupported(): AgentError {
  return new AgentError(
    'UNSUPPORTED_WEBMCP',
    'This browser does not expose the required document.modelContext WebMCP API.',
  );
}

function isNativeContext(value: unknown): value is NativeModelContext {
  if (typeof value !== 'object' || value === null) return false;
  return METHODS.every((method) => typeof Reflect.get(value, method) === 'function');
}

export function getNativeContext(): NativeModelContext {
  const secure: unknown = Reflect.get(globalThis, 'isSecureContext');
  if (secure !== true) throw unsupported();
  const documentValue = Reflect.get(globalThis, 'document');
  if (typeof documentValue !== 'object' || documentValue === null) throw unsupported();
  const context = Reflect.get(documentValue, 'modelContext');
  if (!isNativeContext(context)) throw unsupported();
  return context;
}

export function getCurrentWindow(): object {
  const currentWindow = Reflect.get(globalThis, 'window');
  if (typeof currentWindow !== 'object' || currentWindow === null) throw unsupported();
  return currentWindow;
}
