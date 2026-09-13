import { AgentError, createEmitter, createToolRegistry } from '@webmcp-agent/core';
import type { ToolCall, ToolResult, ToolSnapshot, ToolSource } from '@webmcp-agent/core';

import { executeNativeTool } from '~/execute';
import { getCurrentWindow, getNativeContext } from '~/native';
import { normalizeNativeTool } from '~/normalize';
import type { NormalizedNativeTool } from '~/normalize';

export function createWebMCPSource(): ToolSource {
  const registry = createToolRegistry();
  const changes = createEmitter<void>();
  let executionRevision = 0;
  let lastContentRevision = 0;
  let handles = new Map<string, NormalizedNativeTool>();
  let snapshot: ToolSnapshot = registry.getSnapshot();
  let disposed = false;

  return {
    async discover(signal?: AbortSignal): Promise<ToolSnapshot> {
      if (disposed) throw new AgentError('ABORTED', 'The tool source is disposed.');
      if (signal?.aborted) {
        throw new AgentError('ABORTED', 'The discovery request was aborted.', {
          cause: signal.reason,
        });
      }
      const context = getNativeContext();
      const currentWindow = getCurrentWindow();
      let nativeTools: unknown;
      try {
        nativeTools = await context.getTools();
      } catch (error) {
        if (error instanceof AgentError) throw error;
        throw new AgentError('DISCOVERY_FAILED', 'WebMCP tool discovery failed.', { cause: error });
      }
      if (signal?.aborted) {
        throw new AgentError('ABORTED', 'The discovery request was aborted.', {
          cause: signal.reason,
        });
      }
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
      }
      return snapshot;
    },
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
      changes.clear();
    },
  };
}
