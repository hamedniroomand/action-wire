import { buildConfirmation, needsConfirmation } from '~/agent/confirmation';
import { SAFETY_INSTRUCTIONS } from '~/agent/instructions';
import { createSessionStore } from '~/agent/session';
import { abortFromSignal, assertPositiveMs, operationSignal, runWithOperationTimeout } from '~/agent/timeout';
import { AgentError } from '~/core';
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
} from '~/core';

/* oxlint-disable eslint/no-await-in-loop -- Model rounds and tool calls must run in order. */

const DEFAULT_ROUNDS = 8;
const DEFAULT_TIMEOUT_MS = 30_000;

export function createAgentBridge(options: BridgeOptions): Assistant {
  const session = createSessionStore();
  const maxRounds = options.maxRounds ?? DEFAULT_ROUNDS;
  const timeoutMs = assertPositiveMs(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeoutMs')!;
  const reviewTimeoutMs = assertPositiveMs(options.reviewTimeoutMs, 'reviewTimeoutMs');
  let turnEpoch = 0;
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

  function activeTurn(epoch: number): boolean {
    return epoch === turnEpoch && turn !== undefined;
  }

  async function send(text: string): Promise<void> {
    if (session.getState().busy) {
      throw new AgentError('BUSY', 'The assistant is busy.');
    }
    const epoch = ++turnEpoch;
    const currentTurn = new AbortController();
    turn = currentTurn;
    session.update((state) => ({
      ...appendVisible(stripTransient(state), { role: 'user', content: text }),
      busy: true,
    }));
    try {
      await runTurn(currentTurn.signal, epoch);
    } catch (error) {
      if (!activeTurn(epoch)) return;
      session.update((state) => ({
        ...state,
        busy: false,
        error:
          error instanceof AgentError
            ? { code: error.code, message: error.message }
            : currentTurn.signal.aborted
              ? { code: 'ABORTED', message: 'The assistant was cancelled.' }
              : toStateError(error),
      }));
    } finally {
      if (activeTurn(epoch)) {
        turn = undefined;
        session.update((state) => ({ ...state, busy: false }));
      }
    }
  }

  async function runTurn(turnSignal: AbortSignal, epoch: number): Promise<void> {
    let snapshot = await discoverForTurn(turnSignal, epoch);
    for (let round = 0; round < maxRounds; round += 1) {
      if (!activeTurn(epoch) || turnSignal.aborted) throw abortFromSignal(turnSignal);
      if (round > 0) {
        toolsDirty = false;
        snapshot = await discoverForTurn(turnSignal, epoch);
        if (!activeTurn(epoch) || turnSignal.aborted) throw abortFromSignal(turnSignal);
      }
      const result = await runWithOperationTimeout(turnSignal, timeoutMs, (op) =>
        options.model.generate({
          messages: withInstructions(session.getState().messages),
          tools: snapshot.tools,
          signal: op,
        }),
      );
      if (!activeTurn(epoch)) return;
      if (turnSignal.aborted) throw abortFromSignal(turnSignal);
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
      snapshot = await runCalls(result.toolCalls, snapshot, turnSignal, epoch);
    }
    throw new AgentError('TURN_LIMIT', 'The assistant reached the turn limit.');
  }

  async function discoverForTurn(
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<ToolSnapshot> {
    const snapshot = await runWithOperationTimeout(turnSignal, timeoutMs, (op) =>
      options.source.discover(op),
    );
    if (!activeTurn(epoch)) return snapshot;
    if (turnSignal.aborted) throw abortFromSignal(turnSignal);
    return snapshot;
  }

  async function runCalls(
    calls: readonly ToolCall[],
    snapshot: ToolSnapshot,
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<ToolSnapshot> {
    let current = snapshot;
    for (const call of calls) {
      if (!activeTurn(epoch) || turnSignal.aborted) throw abortFromSignal(turnSignal);
      if (toolsDirty) {
        toolsDirty = false;
        current = await discoverForTurn(turnSignal, epoch);
      }
      if (!activeTurn(epoch) || turnSignal.aborted) throw abortFromSignal(turnSignal);
      session.update((state) => appendActivity(state, { call, status: 'queued' }));
      const tool = current.tools.find((entry) => entry.id === call.toolId);
      let result: ToolResult;
      if (current.revision !== snapshot.revision) {
        result = fail(call.id, 'STALE_TOOLS', 'The tool list changed. Discover tools again.');
      } else if (tool === undefined) {
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
        const approved = await waitForApproval(stored, revisionAtPrompt, turnSignal);
        if (!activeTurn(epoch)) return current;
        if (turnSignal.aborted) throw abortFromSignal(turnSignal);
        session.update((state) => withoutConfirmation(state));
        if (!approved) {
          result = fail(stored.id, 'CONFIRMATION_DENIED', 'The user denied this action.');
        } else {
          const latest = await discoverForTurn(turnSignal, epoch);
          if (!activeTurn(epoch)) return current;
          if (turnSignal.aborted) throw abortFromSignal(turnSignal);
          current = latest;
          toolsDirty = false;
          if (latest.revision !== revisionAtPrompt) {
            result = fail(stored.id, 'STALE_TOOLS', 'The tool list changed. Discover tools again.');
          } else if (latest.tools.every((entry) => entry.id !== stored.toolId)) {
            result = fail(stored.id, 'TOOL_UNAVAILABLE', 'This tool is not available.');
          } else {
            result = await executeCall(stored, latest.revision, turnSignal, epoch);
          }
        }
      } else {
        result = await executeCall(call, current.revision, turnSignal, epoch);
      }
      if (!activeTurn(epoch)) return current;
      if (turnSignal.aborted) throw abortFromSignal(turnSignal);
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
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<ToolResult> {
    session.update((state) => patchActivity(state, call.id, { status: 'running' }));
    const op = runWithOperationTimeout(turnSignal, timeoutMs, (signal) =>
      options.source.execute(call, revision, signal),
    );
    try {
      if (turnSignal.aborted) throw abortFromSignal(turnSignal);
      const result = await op;
      if (!activeTurn(epoch)) return result;
      return result;
    } catch (error) {
      if (!activeTurn(epoch)) {
        return fail(call.id, 'ABORTED', 'The tool call was aborted.');
      }
      if (error instanceof AgentError && (error.code === 'TIMEOUT' || error.code === 'ABORTED')) {
        throw error;
      }
      if (turnSignal.aborted) throw abortFromSignal(turnSignal);
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
    turnSignal: AbortSignal,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let reviewTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (approved: boolean) => {
        turnSignal.removeEventListener('abort', onTurnAbort);
        if (reviewTimer !== undefined) clearTimeout(reviewTimer);
        pending = undefined;
        resolve(approved);
      };
      const onTurnAbort = () => {
        turnSignal.removeEventListener('abort', onTurnAbort);
        if (reviewTimer !== undefined) clearTimeout(reviewTimer);
        pending = undefined;
        reject(abortFromSignal(turnSignal));
      };
      if (turnSignal.aborted) {
        onTurnAbort();
        return;
      }
      turnSignal.addEventListener('abort', onTurnAbort, { once: true });
      if (reviewTimeoutMs !== undefined) {
        reviewTimer = setTimeout(() => {
          turnSignal.removeEventListener('abort', onTurnAbort);
          pending = undefined;
          reject(new AgentError('TIMEOUT', 'The review timed out.'));
        }, reviewTimeoutMs);
      }
      pending = {
        id: call.id,
        call,
        revision,
        finish,
      };
    });
  }

  return {
    send,
    async refreshTools(): Promise<ToolSnapshot> {
      const turnSignal = turn?.signal;
      const op =
        turnSignal === undefined ? undefined : operationSignal(turnSignal, timeoutMs);
      const snapshot = await options.source.discover(op);
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
      turnEpoch += 1;
      const previous = turn;
      turn = undefined;
      pending?.finish(false);
      previous?.abort();
      session.clear();
    },
    getState: () => session.getState(),
    subscribe: (listener) => session.subscribe(listener),
    dispose() {
      turnEpoch += 1;
      const previous = turn;
      turn = undefined;
      pending?.finish(false);
      previous?.abort();
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

function toStateError(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof AgentError) return { code: error.code, message: error.message };
  if (isAbortError(error)) return { code: 'ABORTED', message: 'The assistant was cancelled.' };
  return { code: 'MODEL_ERROR', message: 'The assistant turn failed.' };
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
}

function withInstructions(messages: readonly Message[]): readonly Message[] {
  return [{ role: 'system', content: SAFETY_INSTRUCTIONS }, ...messages];
}
