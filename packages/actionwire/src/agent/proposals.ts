import { needsConfirmation } from '~/agent/confirmation';
import { runWithOperationTimeout } from '~/agent/timeout';
import { AgentError } from '~/core';
import type {
  ContextItem,
  ConfirmationPolicy,
  Proposal,
  ReviewOptions,
  ToolCall,
  ToolDefinition,
  ToolResult,
  ToolSnapshot,
  ToolSource,
  ToolStatus,
} from '~/core';
import { copyToolArguments, validateToolArguments } from '~/core/arguments';
import { freeze } from '~/core/json';

let proposalSeq = 0;

export function createProposalId(): string {
  proposalSeq += 1;
  return `p${proposalSeq}`;
}

export function freezeCall(call: ToolCall): ToolCall {
  return Object.freeze({
    id: call.id,
    toolId: call.toolId,
    arguments: Object.freeze(copyToolArguments(call.arguments)),
  });
}

export function proposalTitle(tool: ToolDefinition): string {
  return tool.title ?? tool.name;
}

export function requiresReview(
  tool: ToolDefinition,
  call: ToolCall,
  policy?: ConfirmationPolicy,
): boolean {
  return needsConfirmation(tool, call, policy);
}

export function isMutatingTool(tool: ToolDefinition): boolean {
  if (tool.consequential === true) return true;
  return tool.readOnly !== true;
}

export function activityStatusFromResult(input: {
  result: ToolResult;
  tool: ToolDefinition | undefined;
  dispatched: boolean;
}): ToolStatus {
  const { result, tool, dispatched } = input;
  if (result.ok) return 'succeeded';
  if (result.code === 'CONFIRMATION_DENIED') return 'denied';
  if (result.code === 'INVALIDATED') return 'invalidated';
  if (result.code === 'ABORTED') return 'cancelled';
  if (result.code === 'OUTCOME_UNKNOWN') return 'outcome-unknown';
  if (
    dispatched &&
    isMutatingTool(tool ?? { id: '', name: '', description: '', inputSchema: { type: 'object' } })
  ) {
    return 'outcome-unknown';
  }
  return 'failed';
}

export function validateModelCall(
  call: ToolCall,
  snapshot: ToolSnapshot,
  seen: Set<string>,
): { tool: ToolDefinition } | { error: string } {
  if (seen.has(call.id)) return { error: 'Duplicate tool call IDs are not allowed.' };
  seen.add(call.id);
  const tool = snapshot.tools.find((entry) => entry.id === call.toolId);
  if (tool === undefined) return { error: 'This tool is not available.' };
  if (!validateToolArguments(tool.inputSchema, call.arguments)) {
    return { error: 'The tool arguments do not match the input schema.' };
  }
  return { tool };
}

export function initialProposal(input: {
  call: ToolCall;
  tool: ToolDefinition;
  toolRevision: number;
  context: readonly ContextItem[];
}): Proposal {
  return {
    id: createProposalId(),
    call: freezeCall(input.call),
    version: 1,
    toolRevision: input.toolRevision,
    context: input.context,
    targets: [],
    title: proposalTitle(input.tool),
    status: 'preparing',
  };
}

export function targetsMatch(
  left: readonly { resource: string; version: string }[],
  right: readonly { resource: string; version: string }[],
): boolean {
  if (left.length !== right.length) return false;
  const a = left.map(targetSortKey).toSorted();
  const b = right.map(targetSortKey).toSorted();
  return a.every((value, index) => value === b[index]);
}

function targetSortKey(entry: { resource: string; version: string }): string {
  return `${entry.resource}\0${entry.version}`;
}

export function capturedContextStillValid(
  captured: readonly ContextItem[],
  live: readonly ContextItem[],
): boolean {
  for (const item of captured) {
    const match = live.find(
      (entry) =>
        entry.id === item.id && entry.resource === item.resource && entry.version === item.version,
    );
    if (match === undefined) return false;
  }
  return true;
}

export async function prepareProposal(input: {
  proposal: Proposal;
  tool: ToolDefinition;
  snapshot: ToolSnapshot;
  source: ToolSource;
  review?: ReviewOptions;
  turnSignal: AbortSignal;
  timeoutMs: number;
  previewToken: { turn: number; version: number };
  turn: number;
}): Promise<Proposal> {
  let next: Proposal = { ...input.proposal, targets: [] };
  if (input.review?.targets !== undefined) {
    try {
      const targets = await runWithOperationTimeout(input.turnSignal, input.timeoutMs, (signal) =>
        input.review!.targets!(next.call, signal),
      );
      next = { ...next, targets: [...targets] };
    } catch (error) {
      const reason = error instanceof AgentError ? error.message : 'Target resolution failed.';
      return { ...next, status: 'needs-input', reason, preview: { kind: 'failed', reason } };
    }
  }
  if (input.previewToken.turn !== input.turn || input.previewToken.version !== next.version) {
    return next;
  }
  const previewId = input.review?.previewTools?.[next.call.toolId];
  if (previewId === undefined) {
    next = {
      ...next,
      preview: {
        kind: 'unavailable',
        reason: 'The application does not provide a preview for this action.',
      },
    };
  } else {
    const previewTool = input.snapshot.tools.find((entry) => entry.id === previewId);
    if (previewTool === undefined) {
      next = {
        ...next,
        status: 'needs-input',
        reason: 'The configured preview tool is not available.',
        preview: { kind: 'failed', reason: 'The configured preview tool is not available.' },
      };
    } else if (
      previewTool.consequential === true ||
      previewTool.readOnly !== true ||
      needsConfirmation(previewTool, next.call)
    ) {
      next = {
        ...next,
        status: 'needs-input',
        reason: 'The preview tool is not read-only.',
        preview: { kind: 'failed', reason: 'The preview tool is not read-only.' },
      };
    } else if (!validateToolArguments(previewTool.inputSchema, next.call.arguments)) {
      next = {
        ...next,
        status: 'needs-input',
        reason: 'The preview arguments are invalid.',
        preview: { kind: 'failed', reason: 'The preview arguments are invalid.' },
      };
    } else {
      const previewCall: ToolCall = {
        id: `${next.id}:preview:${next.version}`,
        toolId: previewId,
        arguments: next.call.arguments,
      };
      try {
        const result = await runWithOperationTimeout(input.turnSignal, input.timeoutMs, (signal) =>
          input.source.execute(previewCall, input.snapshot.revision, signal),
        );
        if (input.previewToken.turn !== input.turn || input.previewToken.version !== next.version) {
          return next;
        }
        if (!result.ok) {
          const reason = result.text || 'Preview failed.';
          next = {
            ...next,
            status: 'needs-input',
            reason,
            preview: { kind: 'failed', reason },
          };
        } else {
          next = {
            ...next,
            preview: {
              kind: 'application',
              text: result.text,
              ...(result.data === undefined ? {} : { data: result.data }),
            },
          };
        }
      } catch (error) {
        const reason = error instanceof AgentError ? error.message : 'Preview failed.';
        next = { ...next, status: 'needs-input', reason, preview: { kind: 'failed', reason } };
      }
    }
  }
  if (next.status === 'preparing' && next.preview?.kind !== 'failed') {
    next = { ...next, status: 'ready-for-review' };
  }
  return freezeProposal(next);
}

export function publishPreparedProposal(
  current: Proposal | undefined,
  prepared: Proposal,
): Proposal | undefined {
  if (current === undefined) return undefined;
  if (current.id !== prepared.id) return undefined;
  if (current.version !== prepared.version) return undefined;
  if (current.status !== 'preparing') return undefined;
  return prepared;
}

export function freezeProposal(proposal: Proposal): Proposal {
  return freeze({
    ...proposal,
    call: freezeCall(proposal.call),
    context: proposal.context.map((item) => freeze({ ...item })),
    targets: proposal.targets.map((target) => freeze({ ...target })),
  });
}

export function invalidateDependents(
  proposals: readonly Proposal[],
  fromIndex: number,
  reason: string,
): Proposal[] {
  return proposals.map((proposal, index) => {
    if (index <= fromIndex) return proposal;
    if (
      proposal.status === 'running' ||
      proposal.status === 'succeeded' ||
      proposal.status === 'failed' ||
      proposal.status === 'denied' ||
      proposal.status === 'cancelled' ||
      proposal.status === 'invalidated' ||
      proposal.status === 'outcome-unknown'
    ) {
      return proposal;
    }
    return freezeProposal({ ...proposal, status: 'invalidated', reason });
  });
}

export function toolResultForProposal(proposal: Proposal, result: ToolResult): ToolResult {
  if (proposal.status !== 'invalidated') return result;
  return {
    callId: proposal.call.id,
    ok: false,
    text: proposal.reason ?? 'This action was invalidated.',
    code: 'INVALIDATED',
  };
}

import type { ErrorCode } from '~/core';

export function failCall(callId: string, code: ErrorCode, text: string): ToolResult {
  return { callId, ok: false, text, code };
}
