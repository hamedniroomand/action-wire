import { createContextController, snapshotItems } from '~/agent/context';
import { createDebugLog } from '~/agent/debug';
import { createReviewGate, needsGate, needsReviewCancel } from '~/agent/gate';
import { prepareProposal, publishPreparedProposal } from '~/agent/preview';
import {
  activityStatusFromResult,
  capturedContextStillValid,
  initialProposal,
  invalidateDependents,
  requiresReview,
  targetsMatch,
  toolResultForProposal,
  validateModelCall,
} from '~/agent/proposals';
import { applyConfirmation, applyProposalEdit, cancelOpenProposals } from '~/agent/review';
import { createSessionStore } from '~/agent/session';
import {
  appendActivity,
  appendProtocol,
  appendVisible,
  lastUserContext,
  patchActivity,
  patchProposal,
  stripTransient,
  toModelMessages,
  withInstructions,
} from '~/agent/state';
import { abortFromSignal, assertPositiveMs, runWithOperationTimeout } from '~/agent/timeout';
import { AgentError } from '~/core';
import type {
  Assistant,
  AssistantState,
  BridgeOptions,
  ErrorCode,
  Json,
  Proposal,
  ToolCall,
  ToolDefinition,
  ToolResult,
  ToolSnapshot,
} from '~/core';
import { validateToolArguments } from '~/core/arguments';
import { failResult } from '~/core/errors';

/* oxlint-disable eslint/no-await-in-loop -- Model rounds and tool calls must run in order. */

const DEFAULT_ROUNDS = 8;
const DEFAULT_TIMEOUT_MS = 30_000;
const STALE_TOOLS_TEXT = 'The tool list changed. Discover tools again.';

type PendingCall = { call: ToolCall; tool: ToolDefinition };

function refusedResult(proposal: Proposal): ToolResult {
  return toolResultForProposal(
    proposal,
    failResult(
      proposal.call.id,
      proposal.status === 'invalidated' ? 'INVALIDATED' : 'CONFIRMATION_DENIED',
      proposal.reason ?? 'The action was not approved.',
    ),
  );
}

function isMutatingFailure(result: ToolResult, tool: ToolDefinition | undefined): boolean {
  if (result.ok) return false;
  if (result.code === 'OUTCOME_UNKNOWN') return true;
  return tool !== undefined && tool.readOnly !== true;
}

export function createAgentBridge(options: BridgeOptions): Assistant {
  const session = createSessionStore();
  const context = createContextController(options.context);
  const logTurn = createDebugLog('turn', options.debug === true);
  const maxRounds = options.maxRounds ?? DEFAULT_ROUNDS;
  const timeoutMs = assertPositiveMs(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeoutMs')!;
  const gate = createReviewGate(assertPositiveMs(options.reviewTimeoutMs, 'reviewTimeoutMs'));
  let turnEpoch = 0;
  let turn: AbortController | undefined;
  let toolsDirty = false;
  let previewToken = { turn: 0, version: 0 };
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
    const captured = snapshotItems(context.captureForSend());
    const epoch = ++turnEpoch;
    const currentTurn = new AbortController();
    turn = currentTurn;
    session.update((state) => ({
      ...appendVisible(stripTransient(state), {
        role: 'user',
        content: text,
        ...(captured.length > 0 ? { context: captured } : {}),
      }),
      context: captured,
      busy: true,
    }));
    try {
      await runTurn(currentTurn.signal, epoch);
    } catch (error) {
      if (!activeTurn(epoch)) return;
      logTurn('failed', {
        code: error instanceof AgentError ? error.code : 'MODEL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
      session.update((state) => ({
        ...state,
        busy: false,
        error:
          error instanceof AgentError
            ? { code: error.code, message: error.message }
            : currentTurn.signal.aborted
              ? { code: 'ABORTED', message: 'The assistant was cancelled.' }
              : { code: 'MODEL_ERROR', message: 'The assistant turn failed.' },
      }));
    } finally {
      if (activeTurn(epoch)) {
        turn = undefined;
        session.update((state) => ({ ...state, busy: false, proposals: [] }));
      }
    }
  }

  async function runTurn(turnSignal: AbortSignal, epoch: number): Promise<void> {
    toolsDirty = false;
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
          messages: withInstructions(toModelMessages(session.getState().messages)),
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
      const stop = await runCalls(result.toolCalls, snapshot, turnSignal, epoch);
      if (stop || !activeTurn(epoch)) return;
      snapshot = await discoverForTurn(turnSignal, epoch);
    }
    throw new AgentError('TURN_LIMIT', 'The assistant reached the turn limit.');
  }

  async function discoverForTurn(turnSignal: AbortSignal, epoch: number): Promise<ToolSnapshot> {
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
  ): Promise<boolean> {
    if (toolsDirty) {
      await failStaleCalls(calls, snapshot, epoch);
      return false;
    }
    const sorted = await classifyCalls(calls, snapshot, turnSignal, epoch);
    if (sorted === undefined) return true;
    if (await runImmediate(sorted.immediate, snapshot, turnSignal, epoch)) return true;
    if (sorted.batch.length === 0) return false;
    await prepareBatch(sorted.batch, snapshot, turnSignal, epoch);
    while (activeTurn(epoch) && needsGate(session.getState().proposals)) {
      await gate.wait(turnSignal);
      if (!activeTurn(epoch)) return true;
    }
    const independent = options.review?.independent?.(calls) ?? false;
    return runReviewedCalls(sorted.batch, independent, turnSignal, epoch);
  }

  async function failStaleCalls(
    calls: readonly ToolCall[],
    snapshot: ToolSnapshot,
    epoch: number,
  ): Promise<void> {
    const seen = new Set<string>();
    for (const call of calls) {
      if (!activeTurn(epoch)) return;
      const validated = validateModelCall(call, snapshot, seen);
      const result =
        'error' in validated
          ? failResult(call.id, 'INVALID_ARGUMENTS', validated.error)
          : failResult(call.id, 'STALE_TOOLS', STALE_TOOLS_TEXT);
      await finishCall(
        call,
        result,
        'error' in validated ? undefined : validated.tool,
        false,
        epoch,
      );
    }
  }

  /** Returns undefined when a call is invalid and the turn must stop. */
  async function classifyCalls(
    calls: readonly ToolCall[],
    snapshot: ToolSnapshot,
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<{ batch: PendingCall[]; immediate: PendingCall[] } | undefined> {
    const seen = new Set<string>();
    const batch: PendingCall[] = [];
    const immediate: PendingCall[] = [];
    for (const call of calls) {
      if (!activeTurn(epoch) || turnSignal.aborted) throw abortFromSignal(turnSignal);
      const validated = validateModelCall(call, snapshot, seen);
      if ('error' in validated) {
        await finishCall(
          call,
          failResult(call.id, 'INVALID_ARGUMENTS', validated.error),
          undefined,
          false,
          epoch,
        );
        return undefined;
      }
      const entry = { call, tool: validated.tool };
      if (requiresReview(validated.tool, call, options.requiresConfirmation)) batch.push(entry);
      else immediate.push(entry);
    }
    return { batch, immediate };
  }

  async function runImmediate(
    immediate: readonly PendingCall[],
    snapshot: ToolSnapshot,
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<boolean> {
    for (const entry of immediate) {
      if (!activeTurn(epoch)) return true;
      if (toolsDirty) {
        await finishCall(
          entry.call,
          failResult(entry.call.id, 'STALE_TOOLS', STALE_TOOLS_TEXT),
          entry.tool,
          false,
          epoch,
        );
        continue;
      }
      const result = await executeDirect(
        entry.call,
        entry.tool,
        snapshot.revision,
        turnSignal,
        epoch,
      );
      if (!result.ok && isMutatingFailure(result, entry.tool)) return true;
    }
    return false;
  }

  async function prepareBatch(
    batch: readonly PendingCall[],
    snapshot: ToolSnapshot,
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<void> {
    const userContext = lastUserContext(session.getState());
    const proposals = batch.map(({ call, tool }) =>
      initialProposal({ call, tool, toolRevision: snapshot.revision, context: userContext }),
    );
    session.update((state) => {
      let next: AssistantState = { ...state, proposals };
      for (const proposal of proposals) {
        next = appendActivity(next, { call: proposal.call, status: 'preparing' });
      }
      return next;
    });
    previewToken = { turn: epoch, version: 0 };
    for (const [index, proposal] of proposals.entries()) {
      previewToken = { turn: epoch, version: proposal.version };
      const prepared = await prepareProposal({
        proposal,
        tool: batch[index]!.tool,
        snapshot,
        source: options.source,
        ...(options.review === undefined ? {} : { review: options.review }),
        turnSignal,
        timeoutMs,
        previewToken,
        turn: epoch,
      });
      if (!activeTurn(epoch)) return;
      publishProposal(proposal.id, prepared);
    }
  }

  function publishProposal(id: string, prepared: Proposal): void {
    const current = session.getState().proposals.find((entry) => entry.id === id);
    const published = publishPreparedProposal(current, prepared);
    if (published === undefined) return;
    session.update((state) => ({
      ...state,
      proposals: state.proposals.map((entry) => (entry.id === id ? published : entry)),
      activities: state.activities.map((activity) =>
        activity.call.id === published.call.id
          ? { ...activity, status: published.status }
          : activity,
      ),
    }));
  }

  async function runReviewedCalls(
    batch: readonly PendingCall[],
    independent: boolean,
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<boolean> {
    const decided = session.getState().proposals;
    for (const [index, proposal] of decided.entries()) {
      const tool = batch[index]?.tool;
      if (!activeTurn(epoch)) return true;
      if (proposal.status === 'denied' || proposal.status === 'invalidated') {
        await finishCall(proposal.call, refusedResult(proposal), tool, false, epoch);
        continue;
      }
      if (proposal.status !== 'approved') continue;
      const live = session.getState().proposals.find((entry) => entry.id === proposal.id);
      if (live === undefined || live.version !== proposal.version || live.status !== 'approved') {
        continue;
      }
      const latest = await guardApproved(live, tool, turnSignal, epoch);
      if (latest === undefined) return true;
      const result = await dispatchApproved(live, tool, latest, turnSignal, epoch);
      if (result.ok) continue;
      if (!independent) {
        session.update((state) => ({
          ...state,
          proposals: invalidateDependents(decided, index, 'A prior action failed.'),
        }));
      }
      if (isMutatingFailure(result, tool)) return true;
    }
    return false;
  }

  /** Returns the snapshot to execute against, or undefined when the turn must stop. */
  async function guardApproved(
    live: Proposal,
    tool: ToolDefinition | undefined,
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<ToolSnapshot | undefined> {
    if (!capturedContextStillValid(live.context, context.live())) {
      await refuse(live, tool, 'INVALIDATED', 'Attached context changed.', epoch);
      return undefined;
    }
    const latest = await discoverForTurn(turnSignal, epoch);
    if (live.toolRevision !== latest.revision) {
      await refuse(live, tool, 'STALE_TOOLS', STALE_TOOLS_TEXT, epoch);
      return undefined;
    }
    if (options.review?.targets === undefined) return latest;
    try {
      const targets = await runWithOperationTimeout(turnSignal, timeoutMs, (signal) =>
        options.review!.targets!(live.call, signal),
      );
      if (targetsMatch(live.targets, targets)) return latest;
      await refuse(live, tool, 'INVALIDATED', 'The action target changed before execution.', epoch);
    } catch (error) {
      const message =
        error instanceof AgentError ? error.message : 'Target resolution failed before execution.';
      await refuse(live, tool, 'INVALIDATED', message, epoch);
    }
    return undefined;
  }

  function refuse(
    live: Proposal,
    tool: ToolDefinition | undefined,
    code: ErrorCode,
    text: string,
    epoch: number,
  ): Promise<void> {
    return finishCall(live.call, failResult(live.call.id, code, text), tool, false, epoch);
  }

  async function dispatchApproved(
    live: Proposal,
    tool: ToolDefinition | undefined,
    latest: ToolSnapshot,
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<ToolResult> {
    session.update((state) =>
      patchActivity(patchProposal(state, live.id, { status: 'running' }), live.call.id, {
        status: 'running',
        dispatched: true,
      }),
    );
    const result = await runWithOperationTimeout(turnSignal, timeoutMs, (op) =>
      options.source.execute(live.call, latest.revision, op),
    );
    await finishCall(live.call, result, tool, true, epoch);
    return result;
  }

  async function executeDirect(
    call: ToolCall,
    tool: ToolDefinition,
    revision: number,
    turnSignal: AbortSignal,
    epoch: number,
  ): Promise<ToolResult> {
    session.update((state) => appendActivity(state, { call, status: 'running', dispatched: true }));
    try {
      const result = await runWithOperationTimeout(turnSignal, timeoutMs, (op) =>
        options.source.execute(call, revision, op),
      );
      await finishCall(call, result, tool, true, epoch);
      return result;
    } catch (error) {
      if (error instanceof AgentError) {
        if (error.code === 'TIMEOUT' || error.code === 'ABORTED') throw error;
        await finishCall(call, failResult(call.id, error.code, error.message), tool, true, epoch);
        return failResult(call.id, error.code, error.message);
      }
      throw error;
    }
  }

  async function finishCall(
    call: ToolCall,
    result: ToolResult,
    tool: ToolDefinition | undefined,
    dispatched: boolean,
    epoch: number,
  ): Promise<void> {
    if (!activeTurn(epoch)) return;
    session.update((state) => {
      const hasActivity = state.activities.some((activity) => activity.call.id === call.id);
      const base = hasActivity
        ? state
        : appendActivity(state, { call, status: 'running', dispatched });
      return appendProtocol(
        patchActivity(base, call.id, {
          status: activityStatusFromResult({ result, tool, dispatched }),
          result,
          dispatched,
        }),
        { role: 'tool', content: result.text, callId: call.id },
      );
    });
  }

  function applyConfirm(id: string, version: number, approved: boolean): void {
    session.update((state) =>
      applyConfirmation(state, { id, version, approved, review: options.review }),
    );
    gate.wake();
  }

  function applyEdit(id: string, version: number, args: Record<string, Json>): void {
    session.update((state) =>
      applyProposalEdit(state, { id, version, args, review: options.review }),
    );
    gate.wake();
    void reprepare(id);
  }

  async function reprepare(id: string): Promise<void> {
    const epoch = turnEpoch;
    const turnSignal = turn?.signal;
    if (turnSignal === undefined) return;
    const state = session.getState();
    const index = state.proposals.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const proposal = state.proposals[index]!;
    const snapshot = await discoverForTurn(turnSignal, epoch);
    const tool = snapshot.tools.find((entry) => entry.id === proposal.call.toolId);
    if (tool === undefined || !validateToolArguments(tool.inputSchema, proposal.call.arguments)) {
      session.update((s) =>
        patchProposal(s, id, {
          status: 'needs-input',
          reason: 'The tool arguments do not match the input schema.',
        }),
      );
      gate.wake();
      return;
    }
    previewToken = { turn: epoch, version: proposal.version };
    const prepared = await prepareProposal({
      proposal,
      tool,
      snapshot,
      source: options.source,
      ...(options.review === undefined ? {} : { review: options.review }),
      turnSignal,
      timeoutMs,
      previewToken,
      turn: epoch,
    });
    if (!activeTurn(epoch)) return;
    const current = session.getState().proposals.find((entry) => entry.id === id);
    const published = publishPreparedProposal(current, prepared);
    if (published === undefined) return;
    session.update((s) => ({
      ...s,
      proposals: s.proposals.map((entry) => (entry.id === id ? published : entry)),
    }));
    gate.wake();
  }

  return {
    send,
    async refreshTools(): Promise<ToolSnapshot> {
      const turnSignal = turn?.signal;
      if (turnSignal === undefined) return options.source.discover();
      return runWithOperationTimeout(turnSignal, timeoutMs, (op) => options.source.discover(op));
    },
    confirm(id, version, approved) {
      applyConfirm(id, version, approved);
    },
    edit(id, version, args) {
      applyEdit(id, version, args);
    },
    removeContext(id) {
      context.remove(id);
      session.update((state) => ({ ...state, context: snapshotItems(context.live()) }));
    },
    cancel() {
      if (needsReviewCancel(session.getState().proposals)) {
        session.update(cancelOpenProposals);
        gate.wake();
        return;
      }
      turn?.abort();
    },
    clear() {
      turnEpoch += 1;
      previewToken = { turn: turnEpoch, version: 0 };
      const previous = turn;
      turn = undefined;
      gate.wake();
      previous?.abort();
      context.reset();
      session.clear();
    },
    getState: () => session.getState(),
    subscribe: (listener) => session.subscribe(listener),
    dispose() {
      turnEpoch += 1;
      const previous = turn;
      turn = undefined;
      gate.wake();
      previous?.abort();
      stopSource();
      context.dispose();
      session.dispose();
    },
  };
}
