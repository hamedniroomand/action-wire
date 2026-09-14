import { needsConfirmation } from '~/agent/confirmation';
import { freezeProposal } from '~/agent/proposals';
import { runWithOperationTimeout } from '~/agent/timeout';
import { AgentError } from '~/core';
import type {
  Proposal,
  ReviewOptions,
  ToolCall,
  ToolDefinition,
  ToolSnapshot,
  ToolSource,
} from '~/core';
import { validateToolArguments } from '~/core/arguments';

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
