import { createContextController, snapshotItems } from '~/agent/context';
import { SAFETY_INSTRUCTIONS } from '~/agent/instructions';
import {
  activityStatusFromResult,
  capturedContextStillValid,
  failCall,
  freezeCall,
  freezeProposal,
  initialProposal,
  invalidateDependents,
  prepareProposal,
  publishPreparedProposal,
  requiresReview,
  targetsMatch,
  toolResultForProposal,
  validateModelCall,
} from '~/agent/proposals';
import { createSessionStore } from '~/agent/session';
import { abortFromSignal, assertPositiveMs, runWithOperationTimeout } from '~/agent/timeout';
import { AgentError } from '~/core';
import type {
  Activity,
  Assistant,
  AssistantState,
  BridgeOptions,
  Json,
  Message,
  Proposal,
  ToolCall,
  ToolDefinition,
  ToolResult,
  ToolSnapshot,
} from '~/core';
import { copyToolArguments, validateToolArguments } from '~/core/arguments';
import type { ContextItem } from '~/core/types';

/* oxlint-disable eslint/no-await-in-loop -- Model rounds and tool calls must run in order. */

const DEFAULT_ROUNDS = 8;
const DEFAULT_TIMEOUT_MS = 30_000;

function needsGate(proposals: readonly Proposal[]): boolean {
  return proposals.some(
    (proposal) =>
      proposal.status === 'preparing' ||
      proposal.status === 'needs-input' ||
      proposal.status === 'ready-for-review',
  );
}

function needsReviewCancel(proposals: readonly Proposal[]): boolean {
  return proposals.some(
    (proposal) =>
      proposal.status === 'preparing' ||
      proposal.status === 'needs-input' ||
      proposal.status === 'ready-for-review' ||
      proposal.status === 'approved',
  );
}

function isMutatingFailure(result: ToolResult, tool: ToolDefinition | undefined): boolean {
  if (result.ok) return false;
  if (result.code === 'OUTCOME_UNKNOWN') return true;
  return tool !== undefined && tool.readOnly !== true;
}

function patchProposal(
  state: AssistantState,
  id: string,
  patch: Partial<Proposal>,
): AssistantState {
  return {
    ...state,
    proposals: state.proposals.map((proposal) =>
      proposal.id === id ? freezeProposal({ ...proposal, ...patch }) : proposal,
    ),
  };
}

export function createAgentBridge(options: BridgeOptions): Assistant {
  const session = createSessionStore();
  const context = createContextController(options.context);
  const maxRounds = options.maxRounds ?? DEFAULT_ROUNDS;
  const timeoutMs = assertPositiveMs(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeoutMs')!;
  const reviewTimeoutMs = assertPositiveMs(options.reviewTimeoutMs, 'reviewTimeoutMs');
  let turnEpoch = 0;
  let turn: AbortController | undefined;
  let toolsDirty = false;
  let gateWaiters: Array<() => void> = [];
  let previewToken = { turn: 0, version: 0 };
  const stopSource = options.source.subscribe(() => {
    toolsDirty = true;
  });

  function activeTurn(epoch: number): boolean {
    return epoch === turnEpoch && turn !== undefined;
  }

  function wakeGate(): void {
    for (const wake of gateWaiters) wake();
    gateWaiters = [];
  }

  function waitForGate(turnSignal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let reviewTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        turnSignal.removeEventListener('abort', onAbort);
        if (reviewTimer !== undefined) clearTimeout(reviewTimer);
        gateWaiters = gateWaiters.filter((entry) => entry !== finish);
        resolve();
      };
      const onAbort = () => {
        turnSignal.removeEventListener('abort', onAbort);
        if (reviewTimer !== undefined) clearTimeout(reviewTimer);
        gateWaiters = gateWaiters.filter((entry) => entry !== finish);
        reject(abortFromSignal(turnSignal));
      };
      if (turnSignal.aborted) {
        onAbort();
        return;
      }
      turnSignal.addEventListener('abort', onAbort, { once: true });
      if (reviewTimeoutMs !== undefined) {
        reviewTimer = setTimeout(() => {
          onAbort();
          reject(new AgentError('TIMEOUT', 'The review timed out.'));
        }, reviewTimeoutMs);
      }
      gateWaiters.push(finish);
    });
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
      const seen = new Set<string>();
      for (const call of calls) {
        if (!activeTurn(epoch)) return true;
        const validated = validateModelCall(call, snapshot, seen);
        const result =
          'error' in validated
            ? failCall(call.id, 'INVALID_ARGUMENTS', validated.error)
            : failCall(call.id, 'STALE_TOOLS', 'The tool list changed. Discover tools again.');
        await finishCall(
          call,
          result,
          'error' in validated ? undefined : validated.tool,
          false,
          epoch,
        );
      }
      return false;
    }
    const seen = new Set<string>();
    const independent = options.review?.independent?.(calls) ?? false;
    const batch: { call: ToolCall; tool: ToolDefinition }[] = [];
    const immediate: { call: ToolCall; tool: ToolDefinition }[] = [];
    let userContext: readonly ContextItem[] = [];
    for (let index = session.getState().messages.length - 1; index >= 0; index -= 1) {
      const message = session.getState().messages[index];
      if (message?.role === 'user') {
        userContext = message.context ?? [];
        break;
      }
    }
    for (const call of calls) {
      if (!activeTurn(epoch) || turnSignal.aborted) throw abortFromSignal(turnSignal);
      const validated = validateModelCall(call, snapshot, seen);
      if ('error' in validated) {
        await finishCall(
          call,
          failCall(call.id, 'INVALID_ARGUMENTS', validated.error),
          undefined,
          false,
          epoch,
        );
        return true;
      }
      if (requiresReview(validated.tool, call, options.requiresConfirmation)) {
        batch.push({ call, tool: validated.tool });
      } else {
        immediate.push({ call, tool: validated.tool });
      }
    }
    for (const entry of immediate) {
      if (!activeTurn(epoch)) return true;
      if (toolsDirty) {
        await finishCall(
          entry.call,
          failCall(entry.call.id, 'STALE_TOOLS', 'The tool list changed. Discover tools again.'),
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
    if (batch.length === 0) return false;
    let proposals = batch.map(({ call, tool }) =>
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
    for (let index = 0; index < proposals.length; index += 1) {
      const proposal = proposals[index]!;
      const tool = batch[index]!.tool;
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
      if (!activeTurn(epoch)) return true;
      const current = session.getState().proposals.find((entry) => entry.id === proposal.id);
      const published = publishPreparedProposal(current, prepared);
      if (published === undefined) continue;
      proposals = proposals.map((entry, at) => (at === index ? published : entry));
      session.update((state) => ({
        ...state,
        proposals,
        activities: state.activities.map((activity) =>
          activity.call.id === published.call.id
            ? { ...activity, status: published.status }
            : activity,
        ),
      }));
    }
    while (activeTurn(epoch) && needsGate(session.getState().proposals)) {
      await waitForGate(turnSignal);
      if (!activeTurn(epoch)) return true;
    }
    const finalProposals = session.getState().proposals;
    for (let index = 0; index < finalProposals.length; index += 1) {
      const proposal = finalProposals[index]!;
      if (!activeTurn(epoch)) return true;
      if (proposal.status === 'denied' || proposal.status === 'invalidated') {
        await finishCall(
          proposal.call,
          toolResultForProposal(
            proposal,
            failCall(
              proposal.call.id,
              proposal.status === 'invalidated' ? 'INVALIDATED' : 'CONFIRMATION_DENIED',
              proposal.reason ?? 'The action was not approved.',
            ),
          ),
          batch[index]?.tool,
          false,
          epoch,
        );
        continue;
      }
      if (proposal.status !== 'approved') continue;
      const liveProposal = session.getState().proposals.find((entry) => entry.id === proposal.id);
      if (
        liveProposal === undefined ||
        liveProposal.version !== proposal.version ||
        liveProposal.status !== 'approved'
      ) {
        continue;
      }
      if (!capturedContextStillValid(liveProposal.context, context.live())) {
        await finishCall(
          liveProposal.call,
          failCall(liveProposal.call.id, 'INVALIDATED', 'Attached context changed.'),
          batch[index]?.tool,
          false,
          epoch,
        );
        return true;
      }
      const tool = batch[index]?.tool;
      const latest = await discoverForTurn(turnSignal, epoch);
      if (liveProposal.toolRevision !== latest.revision) {
        await finishCall(
          liveProposal.call,
          failCall(
            liveProposal.call.id,
            'STALE_TOOLS',
            'The tool list changed. Discover tools again.',
          ),
          tool,
          false,
          epoch,
        );
        return true;
      }
      if (options.review?.targets !== undefined) {
        try {
          const targets = await runWithOperationTimeout(turnSignal, timeoutMs, (signal) =>
            options.review!.targets!(liveProposal.call, signal),
          );
          if (!targetsMatch(liveProposal.targets, targets)) {
            await finishCall(
              liveProposal.call,
              failCall(
                liveProposal.call.id,
                'INVALIDATED',
                'The action target changed before execution.',
              ),
              tool,
              false,
              epoch,
            );
            return true;
          }
        } catch (error) {
          const message =
            error instanceof AgentError
              ? error.message
              : 'Target resolution failed before execution.';
          await finishCall(
            liveProposal.call,
            failCall(liveProposal.call.id, 'INVALIDATED', message),
            tool,
            false,
            epoch,
          );
          return true;
        }
      }
      const dispatched = true;
      session.update((state) =>
        patchActivity(
          patchProposal(state, liveProposal.id, { status: 'running' }),
          liveProposal.call.id,
          {
            status: 'running',
            dispatched: true,
          },
        ),
      );
      const result = await runWithOperationTimeout(turnSignal, timeoutMs, (op) =>
        options.source.execute(liveProposal.call, latest.revision, op),
      );
      await finishCall(liveProposal.call, result, tool, dispatched, epoch);
      if (!result.ok) {
        if (!independent) {
          const invalidated = invalidateDependents(finalProposals, index, 'A prior action failed.');
          session.update((state) => ({ ...state, proposals: invalidated }));
        }
        if (isMutatingFailure(result, tool)) return true;
      }
    }
    return false;
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
        await finishCall(call, failCall(call.id, error.code, error.message), tool, true, epoch);
        return failCall(call.id, error.code, error.message);
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
    session.update((state) => {
      const index = state.proposals.findIndex((entry) => entry.id === id);
      if (index < 0) return state;
      const proposal = state.proposals[index]!;
      if (proposal.version !== version) return state;
      if (approved && proposal.status !== 'ready-for-review') return state;
      if (
        !approved &&
        proposal.status !== 'ready-for-review' &&
        proposal.status !== 'needs-input' &&
        proposal.status !== 'preparing' &&
        proposal.status !== 'approved'
      ) {
        return state;
      }
      const independent =
        options.review?.independent?.(state.proposals.map((p) => p.call)) ?? false;
      let proposals = state.proposals.map((entry) => {
        if (entry.id !== id) return entry;
        const patch: Pick<Proposal, 'status'> & Partial<Pick<Proposal, 'reason'>> = approved
          ? { status: 'approved' }
          : { status: 'denied', reason: 'The user excluded this action.' };
        return freezeProposal({ ...entry, ...patch });
      });
      if (!approved && !independent) {
        proposals = invalidateDependents(proposals, index, 'An earlier action changed.');
      }
      return { ...state, proposals };
    });
    wakeGate();
  }

  function applyEdit(id: string, version: number, args: Record<string, Json>): void {
    session.update((state) => {
      const index = state.proposals.findIndex((entry) => entry.id === id);
      if (index < 0) return state;
      const proposal = state.proposals[index]!;
      if (proposal.version !== version) return state;
      if (proposal.status === 'running' || proposal.status === 'succeeded') return state;
      const tool = state.activities.find((a) => a.call.id === proposal.call.id);
      void tool;
      const nextCall = freezeCall({ ...proposal.call, arguments: copyToolArguments(args) });
      const independent =
        options.review?.independent?.(state.proposals.map((p) => p.call)) ?? false;
      let proposals = state.proposals.map((entry) => {
        if (entry.id !== id) return entry;
        const { preview: _preview, reason: _reason, ...rest } = entry;
        return freezeProposal({
          ...rest,
          call: nextCall,
          version: entry.version + 1,
          status: 'preparing',
        });
      });
      if (!independent)
        proposals = invalidateDependents(proposals, index, 'An earlier action changed.');
      return { ...state, proposals };
    });
    wakeGate();
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
      wakeGate();
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
    wakeGate();
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
        session.update((state) => ({
          ...state,
          proposals: state.proposals.map((proposal) =>
            proposal.status === 'ready-for-review' ||
            proposal.status === 'preparing' ||
            proposal.status === 'needs-input' ||
            proposal.status === 'approved'
              ? freezeProposal({ ...proposal, status: 'denied', reason: 'The user cancelled.' })
              : proposal,
          ),
        }));
        wakeGate();
        return;
      }
      turn?.abort();
    },
    clear() {
      turnEpoch += 1;
      previewToken = { turn: turnEpoch, version: 0 };
      const previous = turn;
      turn = undefined;
      wakeGate();
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
      wakeGate();
      previous?.abort();
      stopSource();
      context.dispose();
      session.dispose();
    },
  };
}

function stripTransient(state: AssistantState): AssistantState {
  return {
    timeline: state.timeline,
    messages: state.messages,
    activities: state.activities,
    context: state.context,
    proposals: [],
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

function withInstructions(messages: readonly Message[]): readonly Message[] {
  return [{ role: 'system', content: SAFETY_INSTRUCTIONS }, ...messages];
}

function toModelMessages(messages: readonly Message[]): readonly Message[] {
  return messages.map((message) => {
    if (message.role !== 'user' || message.context === undefined || message.context.length === 0) {
      return message;
    }
    const contextText = message.context
      .map((item) => `${item.label} [${item.resource} @ ${item.version}]`)
      .join('; ');
    return {
      role: 'user',
      content: `${message.content}\n\nAttached context (untrusted data): ${contextText}`,
      context: message.context,
    };
  });
}
