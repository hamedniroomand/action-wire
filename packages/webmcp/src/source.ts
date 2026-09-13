import { AgentError, createEmitter, createToolRegistry } from '@webmcp-agent/core';
import type { ToolCall, ToolResult, ToolSnapshot, ToolSource } from '@webmcp-agent/core';

import { executeNativeTool } from '~/execute';
import { createGeneration, listenForToolChange } from '~/lifecycle';
import { getCurrentWindow, getNativeContext } from '~/native';
import { normalizeNativeTool } from '~/normalize';
import type { NormalizedNativeTool } from '~/normalize';

function noop() {}

export function createWebMCPSource(): ToolSource {
  const registry = createToolRegistry();
  const changes = createEmitter<undefined>();
  const generation = createGeneration();
  let executionRevision = 0;
  let lastContentRevision = 0;
  let handles = new Map<string, NormalizedNativeTool>();
  let snapshot: ToolSnapshot = registry.getSnapshot();
  let disposed = false;
  let inflight: Promise<ToolSnapshot> | undefined;
  let detachToolChange = noop;

  async function discover(signal?: AbortSignal): Promise<ToolSnapshot> {
    if (disposed) throw new AgentError('ABORTED', 'The tool source is disposed.');
    if (signal?.aborted) {
      throw new AgentError('ABORTED', 'The discovery request was aborted.', {
        cause: signal.reason,
      });
    }
    const token = generation.next();
    const run = load(token, signal);
    inflight = run;
    try {
      return await run;
    } finally {
      if (inflight === run) inflight = undefined;
    }
  }

  async function load(token: number, signal: AbortSignal | undefined): Promise<ToolSnapshot> {
    const context = getNativeContext();
    const currentWindow = getCurrentWindow();
    let nativeTools: unknown;
    try {
      nativeTools = await context.getTools();
    } catch (error) {
      if (error instanceof AgentError) throw error;
      throw new AgentError('DISCOVERY_FAILED', 'WebMCP tool discovery failed.', { cause: error });
    }
    if (disposed) throw new AgentError('ABORTED', 'The tool source is disposed.');
    if (signal?.aborted) {
      throw new AgentError('ABORTED', 'The discovery request was aborted.', {
        cause: signal.reason,
      });
    }
    if (!generation.isCurrent(token)) return (await inflight) ?? snapshot;
    if (!Array.isArray(nativeTools)) {
      throw new AgentError('DISCOVERY_FAILED', 'WebMCP getTools must return a list.');
    }
    const current: NormalizedNativeTool[] = [];
    for (const entry of nativeTools) {
      if (typeof entry !== 'object' || entry === null) {
        throw new AgentError('INVALID_SCHEMA', 'Each native tool must be an object.');
      }
      if (Reflect.get(entry, 'window') !== currentWindow) continue;
      current.push(normalizeNativeTool(entry));
    }
    const content = registry.replace(current.map((item) => item.definition));
    const next = new Map(current.map((item) => [item.definition.id, item]));
    let handlesChanged = next.size !== handles.size;
    if (!handlesChanged) {
      for (const [id, item] of next) {
        if (handles.get(id)?.native !== item.native) {
          handlesChanged = true;
          break;
        }
      }
    }
    if (handlesChanged || content.revision !== lastContentRevision) {
      executionRevision += 1;
      handles = next;
      lastContentRevision = content.revision;
      snapshot = Object.freeze({ revision: executionRevision, tools: content.tools });
      changes.emit(undefined);
    }
    return snapshot;
  }

  try {
    detachToolChange = listenForToolChange(getNativeContext(), () => {
      void discover().catch(() => {});
    });
  } catch (error) {
    if (!(error instanceof AgentError) || error.code !== 'UNSUPPORTED_WEBMCP') throw error;
  }

  return {
    discover,
    async execute(call: ToolCall, revision: number, signal?: AbortSignal): Promise<ToolResult> {
      return executeNativeTool({
        call,
        revision,
        signal,
        disposed,
        currentRevision: executionRevision,
        handles,
      });
    },
    subscribe(listener) {
      return changes.subscribe(() => {
        listener();
      });
    },
    dispose() {
      disposed = true;
      detachToolChange();
      detachToolChange = noop;
      changes.clear();
    },
  };
}
