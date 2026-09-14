import { SAFETY_INSTRUCTIONS } from '~/agent/instructions';
import { freezeProposal } from '~/agent/proposals';
import type { Activity, AssistantState, ContextItem, Message, Proposal } from '~/core';

export function stripTransient(state: AssistantState): AssistantState {
  return {
    timeline: state.timeline,
    messages: state.messages,
    activities: state.activities,
    context: state.context,
    proposals: [],
    busy: state.busy,
  };
}

export function appendVisible(state: AssistantState, message: Message): AssistantState {
  const index = state.messages.length;
  return {
    ...state,
    messages: [...state.messages, message],
    timeline: [...state.timeline, { kind: 'message', index }],
  };
}

export function appendProtocol(state: AssistantState, message: Message): AssistantState {
  return { ...state, messages: [...state.messages, message] };
}

export function appendActivity(state: AssistantState, activity: Activity): AssistantState {
  return {
    ...state,
    activities: [...state.activities, activity],
    timeline: [...state.timeline, { kind: 'activity', callId: activity.call.id }],
  };
}

export function patchActivity(
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

export function patchProposal(
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

export function lastUserContext(state: AssistantState): readonly ContextItem[] {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];
    if (message?.role === 'user') return message.context ?? [];
  }
  return [];
}

export function withInstructions(messages: readonly Message[]): readonly Message[] {
  return [{ role: 'system', content: SAFETY_INSTRUCTIONS }, ...messages];
}

export function toModelMessages(messages: readonly Message[]): readonly Message[] {
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
