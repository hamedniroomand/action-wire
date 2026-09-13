import type { AssistantState, Message } from '~/core';
import { busyCopy, emptyCopy, friendlyError } from '~/widget/errors';
import { updateToolCard } from '~/widget/tool-card';

const NEAR_BOTTOM_PX = 48;

export function attachTimeline(
  root: HTMLElement,
  options: { developerMode: boolean },
): (state: AssistantState) => void {
  const nodes = new Map<string, HTMLElement>();
  const empty = document.createElement('p');
  empty.className = 'timeline-empty';
  empty.textContent = emptyCopy();
  const busy = document.createElement('p');
  busy.className = 'timeline-busy';
  busy.textContent = busyCopy();
  const error = document.createElement('p');
  error.className = 'timeline-error';
  error.hidden = true;

  return (state) => {
    const near = isNearBottom(root);
    const keep = root.scrollTop;
    const seen = new Set<string>();
    empty.hidden = state.timeline.length > 0 || state.busy || state.error !== undefined;
    busy.hidden = !state.busy;
    if (state.error === undefined) {
      error.hidden = true;
      error.textContent = '';
    } else {
      error.hidden = false;
      error.textContent = friendlyError(state.error.code);
    }
    root.append(empty, busy, error);
    for (const item of state.timeline) {
      const node = itemNode(nodes, item, state, options.developerMode);
      if (node === undefined) continue;
      root.append(node);
      seen.add(item.kind === 'message' ? `m:${item.index}` : `a:${item.callId}`);
    }
    for (const [key, node] of nodes) {
      if (seen.has(key)) continue;
      node.remove();
      nodes.delete(key);
    }
    root.scrollTop = near ? root.scrollHeight : keep;
  };
}

function itemNode(
  nodes: Map<string, HTMLElement>,
  item: AssistantState['timeline'][number],
  state: AssistantState,
  developerMode: boolean,
): HTMLElement | undefined {
  if (item.kind === 'message') {
    const message = state.messages[item.index];
    if (message === undefined || message.role === 'system' || message.role === 'tool') {
      return undefined;
    }
    const key = `m:${item.index}`;
    let node = nodes.get(key);
    if (node === undefined) {
      node = renderMessage(message);
      nodes.set(key, node);
    }
    return node;
  }
  const activity = state.activities.find((entry) => entry.call.id === item.callId);
  if (activity === undefined) return undefined;
  const key = `a:${item.callId}`;
  let node = nodes.get(key);
  if (node === undefined) {
    node = document.createElement('article');
    nodes.set(key, node);
  }
  updateToolCard(node, activity, developerMode);
  return node;
}

function renderMessage(message: Message): HTMLElement {
  const node = document.createElement('p');
  node.className = `message message-${message.role}`;
  node.textContent = message.content;
  return node;
}

function isNearBottom(root: HTMLElement): boolean {
  return root.scrollHeight - root.scrollTop - root.clientHeight <= NEAR_BOTTOM_PX;
}
