import { AgentError } from '@webmcp-agent/core';
import type {
  Activity,
  Assistant,
  AssistantState,
  BridgeOptions,
  ErrorCode,
  Message,
  ToolCall,
  ToolResult,
  ToolSnapshot,
} from '@webmcp-agent/core';

import { buildConfirmation, needsConfirmation } from '~/confirmation';
import { createSessionStore } from '~/session';

/* oxlint-disable eslint/no-await-in-loop -- Model rounds and tool calls must run in order. */

const DEFAULT_ROUNDS = 8;
const DEFAULT_TIMEOUT_MS = 30_000;

export function createAgentBridge(options: BridgeOptions): Assistant {
  const session = createSessionStore();
  const maxRounds = options.maxRounds ?? DEFAULT_ROUNDS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let turn: AbortController | undefined;
  let toolsDirty = false;
  let pending:
    | {
        id: string;
        call: ToolCall;
        revision: number;
        finish: (approved: boolean) => void;
      }
    | undefined;
  const stopSource = options.source.subscribe(() => {
    toolsDirty = true;
  });

  async function send(text: string): Promise<void> {
    if (session.getState().busy) {
      throw new AgentError('BUSY', 'The assistant is busy.');
    }
    turn = new AbortController();
    session.update((state) => ({
      ...appendVisible(stripTransient(state), { role: 'user', content: text }),
      busy: true,
    }));
    try {
      await runTurn();
    } catch (error) {
      session.update((state) => ({
        ...state,
        busy: false,
        error: toStateError(error),
      }));
    } finally {
      session.update((state) => ({ ...state, busy: false }));
      turn = undefined;
    }
  }

  async function runTurn(): Promise<void> {
    const signal = boundSignal();
    let snapshot = await options.source.discover(signal);
    for (let round = 0; round < maxRounds; round += 1) {
      if (signal.aborted) throw abortError(signal);
      const result = await options.model.generate({
        messages: session.getState().messages,
        tools: snapshot.tools,
        signal,
      });
      if (result.toolCalls.length === 0) {
        session.update((state) =>
          appendVisible(state, { role: 'assistant', content: result.text }),
        );
        return;
      }
      session.update((state) =>
        appendProtocol(state, {
          role: 'assistant',
          content: result.text,
          toolCalls: result.toolCalls,
        }),
      );
      snapshot = await runCalls(result.toolCalls, snapshot, signal);
    }
    throw new AgentError('TURN_LIMIT', 'The assistant reached the turn limit.');
  }

  async function runCalls(
    calls: readonly ToolCall[],
    snapshot: ToolSnapshot,
    signal: AbortSignal,
  ): Promise<ToolSnapshot> {
    let current = snapshot;
    for (const call of calls) {
      if (signal.aborted) throw abortError(signal);
      if (toolsDirty) {
        toolsDirty = false;
        current = await options.source.discover(signal);
      }
      session.update((state) => appendActivity(state, { call, status: 'queued' }));
      const tool = current.tools.find((entry) => entry.id === call.toolId);
      let result: ToolResult;
      if (tool === undefined) {
        result = fail(call.id, 'TOOL_UNAVAILABLE', 'This tool is not available.');
      } else if (needsConfirmation(tool, call, options.requiresConfirmation)) {
        const revisionAtPrompt = current.revision;
        const stored = freezeCall(call);
        session.update((state) =>
          patchActivity(
            { ...state, confirmation: buildConfirmation(tool, stored, revisionAtPrompt) },
            stored.id,
            { status: 'awaiting-confirmation' },
          ),
        );
        const approved = await waitForApproval(stored, revisionAtPrompt, signal);
        session.update((state) => withoutConfirmation(state));
        if (!approved) {
          result = fail(stored.id, 'CONFIRMATION_DENIED', 'The user denied this action.');
        } else {
          const latest = await options.source.discover(signal);
          current = latest;
          toolsDirty = false;
          if (latest.revision !== revisionAtPrompt) {
            result = fail(stored.id, 'STALE_TOOLS', 'The tool list changed. Discover tools again.');
          } else if (latest.tools.every((entry) => entry.id !== stored.toolId)) {
            result = fail(stored.id, 'TOOL_UNAVAILABLE', 'This tool is not available.');
          } else {
            result = await executeCall(stored, latest.revision, signal);
          }
        }
      } else {
        result = await executeCall(call, current.revision, signal);
      }
      session.update((state) =>
        appendProtocol(patchActivity(state, call.id, activityFrom(result)), {
          role: 'tool',
          content: result.text,
          callId: call.id,
        }),
      );
    }
    return current;
  }

  async function executeCall(
    call: ToolCall,
    revision: number,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    session.update((state) => patchActivity(state, call.id, { status: 'running' }));
    try {
      return await options.source.execute(call, revision, signal);
    } catch (error) {
      if (signal.aborted) throw abortError(signal);
      return fail(
        call.id,
        error instanceof AgentError ? error.code : 'EXECUTION_FAILED',
        error instanceof Error ? error.message : 'Tool execution failed.',
      );
    }
  }

  function waitForApproval(
    call: ToolCall,
    revision: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        pending = undefined;
        reject(abortError(signal));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      pending = {
        id: call.id,
        call,
        revision,
        finish(approved) {
          signal.removeEventListener('abort', onAbort);
          pending = undefined;
          resolve(approved);
        },
      };
    });
  }

  function boundSignal(): AbortSignal {
    const timeout = AbortSignal.timeout(timeoutMs);
    if (turn === undefined) return timeout;
    return AbortSignal.any([turn.signal, timeout]);
  }

  return {
    send,
    async refreshTools(): Promise<ToolSnapshot> {
      const snapshot = await options.source.discover(turn?.signal);
      toolsDirty = false;
      return snapshot;
    },
    confirm(id, approved) {
      if (pending === undefined || pending.id !== id) return;
      pending.finish(approved);
    },
    cancel() {
      if (pending !== undefined) {
        pending.finish(false);
        return;
      }
      turn?.abort();
    },
    clear() {
      pending?.finish(false);
      turn?.abort();
      session.clear();
    },
    getState: () => session.getState(),
    subscribe: (listener) => session.subscribe(listener),
    dispose() {
      pending?.finish(false);
      turn?.abort();
      stopSource();
      session.dispose();
    },
  };
}

function freezeCall(call: ToolCall): ToolCall {
  return Object.freeze({
    id: call.id,
    toolId: call.toolId,
    arguments: Object.freeze({ ...call.arguments }),
  });
}

function withoutConfirmation(state: AssistantState): AssistantState {
  return {
    timeline: state.timeline,
    messages: state.messages,
    activities: state.activities,
    busy: state.busy,
    ...(state.error === undefined ? {} : { error: state.error }),
  };
}

function stripTransient(state: AssistantState): AssistantState {
  return {
    timeline: state.timeline,
    messages: state.messages,
    activities: state.activities,
    busy: state.busy,
  };
}

function appendVisible(state: AssistantState, message: Message): AssistantState {
  const index = state.messages.length;
  return {
    ...state,
    messages: [...state.messages, message],
    timeline: [...state.timeline, { kind: 'message', index }],
  };
}

function appendProtocol(state: AssistantState, message: Message): AssistantState {
  return { ...state, messages: [...state.messages, message] };
}

function appendActivity(state: AssistantState, activity: Activity): AssistantState {
  return {
    ...state,
    activities: [...state.activities, activity],
    timeline: [...state.timeline, { kind: 'activity', callId: activity.call.id }],
  };
}

function patchActivity(
  state: AssistantState,
  callId: string,
  patch: Partial<Activity>,
): AssistantState {
  return {
    ...state,
    activities: state.activities.map((activity) =>
      activity.call.id === callId ? { ...activity, ...patch } : activity,
    ),
  };
}

function activityFrom(result: ToolResult): Partial<Activity> {
  if (result.ok) return { status: 'success', result };
  if (result.code === 'ABORTED' || result.code === 'CONFIRMATION_DENIED') {
    return { status: 'cancelled', result };
  }
  return { status: 'error', result };
}

function fail(callId: string, code: ErrorCode, text: string): ToolResult {
  return { callId, ok: false, text, code };
}

function abortError(signal: AbortSignal): AgentError {
  const reason = signal.reason;
  if (isTimeout(reason) || isTimeout(signal)) {
    return new AgentError('TIMEOUT', 'The assistant timed out.');
  }
  return new AgentError('ABORTED', 'The assistant was cancelled.');
}

function isTimeout(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && Reflect.get(value, 'name') === 'TimeoutError'
  );
}

function toStateError(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof AgentError) return { code: error.code, message: error.message };
  return { code: 'MODEL_ERROR', message: 'The assistant turn failed.' };
}
