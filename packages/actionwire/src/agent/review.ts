import { freezeCall, freezeProposal, invalidateDependents } from '~/agent/proposals';
import type { AssistantState, Json, Proposal, ReviewOptions } from '~/core';
import { copyToolArguments } from '~/core/arguments';

const DEPENDENT_REASON = 'An earlier action changed.';

function isIndependent(state: AssistantState, review: ReviewOptions | undefined): boolean {
  return review?.independent?.(state.proposals.map((proposal) => proposal.call)) ?? false;
}

function locate(state: AssistantState, id: string, version: number): number {
  const index = state.proposals.findIndex((entry) => entry.id === id);
  if (index < 0) return -1;
  return state.proposals[index]!.version === version ? index : -1;
}

function replaceAt(
  state: AssistantState,
  index: number,
  next: Proposal,
  review: ReviewOptions | undefined,
  invalidateAfter: boolean,
): AssistantState {
  let proposals = state.proposals.map((entry, at) => (at === index ? next : entry));
  if (invalidateAfter && !isIndependent(state, review)) {
    proposals = invalidateDependents(proposals, index, DEPENDENT_REASON);
  }
  return { ...state, proposals };
}

export function applyConfirmation(
  state: AssistantState,
  input: { id: string; version: number; approved: boolean; review: ReviewOptions | undefined },
): AssistantState {
  const index = locate(state, input.id, input.version);
  if (index < 0) return state;
  const proposal = state.proposals[index]!;
  if (input.approved) {
    if (proposal.status !== 'ready-for-review') return state;
    return replaceAt(
      state,
      index,
      freezeProposal({ ...proposal, status: 'approved' }),
      input.review,
      false,
    );
  }
  if (
    proposal.status !== 'ready-for-review' &&
    proposal.status !== 'needs-input' &&
    proposal.status !== 'preparing' &&
    proposal.status !== 'approved'
  ) {
    return state;
  }
  const denied = freezeProposal({
    ...proposal,
    status: 'denied',
    reason: 'The user excluded this action.',
  });
  return replaceAt(state, index, denied, input.review, true);
}

export function applyProposalEdit(
  state: AssistantState,
  input: {
    id: string;
    version: number;
    args: Record<string, Json>;
    review: ReviewOptions | undefined;
  },
): AssistantState {
  const index = locate(state, input.id, input.version);
  if (index < 0) return state;
  const proposal = state.proposals[index]!;
  if (proposal.status === 'running' || proposal.status === 'succeeded') return state;
  const { preview: _preview, reason: _reason, ...rest } = proposal;
  const edited = freezeProposal({
    ...rest,
    call: freezeCall({ ...proposal.call, arguments: copyToolArguments(input.args) }),
    version: proposal.version + 1,
    status: 'preparing',
  });
  return replaceAt(state, index, edited, input.review, true);
}

export function cancelOpenProposals(state: AssistantState): AssistantState {
  return {
    ...state,
    proposals: state.proposals.map((proposal) =>
      proposal.status === 'ready-for-review' ||
      proposal.status === 'preparing' ||
      proposal.status === 'needs-input' ||
      proposal.status === 'approved'
        ? freezeProposal({ ...proposal, status: 'denied', reason: 'The user cancelled.' })
        : proposal,
    ),
  };
}
