import type { Activity, AssistantState, Message } from '~/core';
import { closeIcon } from '~/widget/icons';
import { renderMarkdown } from '~/widget/markdown';

const STATUS: Record<Activity['status'], string> = {
  preparing: 'Preparing',
  'needs-input': 'Needs input',
  'ready-for-review': 'Ready for review',
  approved: 'Approved',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  denied: 'Denied',
  invalidated: 'Invalidated',
  cancelled: 'Cancelled',
  'outcome-unknown': 'Outcome unknown',
};
const NEAR_BOTTOM_PX = 48;

export type TranscriptHandlers = { close: () => void; clear: () => void };

export function createTranscript(
  root: HTMLElement,
  handlers: TranscriptHandlers,
  options: { developerMode: boolean },
): { sync(state: AssistantState, open: boolean): void } {
  root.className = 'transcript';
  root.setAttribute('aria-label', 'Transcript');
  root.hidden = true;
  const head = document.createElement('div');
  head.className = 'transcript-head';
  const title = document.createElement('span');
  title.textContent = 'This session';
  const actions = document.createElement('span');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'pill';
  clear.textContent = 'clear';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ibtn';
  close.setAttribute('aria-label', 'Close transcript');
  close.append(closeIcon());
  actions.append(clear, close);
  head.append(title, actions);
  const entries = document.createElement('div');
  entries.className = 'entries';
  root.append(head, entries);
  clear.addEventListener('click', handlers.clear);
  close.addEventListener('click', handlers.close);

  const nodes = new Map<string, HTMLElement>();

  return {
    sync(state, open) {
      const wasHidden = root.hidden;
      root.hidden = !open;
      if (!open) return;
      const near = wasHidden || isNearBottom(root);
      const seen = new Set<string>();
      for (const item of state.timeline) {
        const key = item.kind === 'message' ? `m:${item.index}` : `a:${item.callId}`;
        const node = entryNode(key, item, state, options.developerMode, nodes);
        if (node === undefined) continue;
        entries.append(node);
        seen.add(key);
      }
      for (const [key, node] of nodes) {
        if (seen.has(key)) continue;
        node.remove();
        nodes.delete(key);
      }
      if (near) root.scrollTop = root.scrollHeight;
    },
  };
}

function entryNode(
  key: string,
  item: AssistantState['timeline'][number],
  state: AssistantState,
  developerMode: boolean,
  nodes: Map<string, HTMLElement>,
): HTMLElement | undefined {
  if (item.kind === 'message') {
    const message = state.messages[item.index];
    if (message === undefined || message.role === 'system' || message.role === 'tool') {
      return undefined;
    }
    let node = nodes.get(key);
    if (node === undefined) {
      node = renderMessage(message);
      nodes.set(key, node);
    }
    return node;
  }
  const activity = state.activities.find((entry) => entry.call.id === item.callId);
  if (activity === undefined) return undefined;
  let node = nodes.get(key);
  if (node === undefined) {
    node = document.createElement('div');
    nodes.set(key, node);
  }
  updateTool(node, activity, developerMode);
  return node;
}

function renderMessage(message: Message): HTMLElement {
  const node = document.createElement('div');
  node.className = `entry entry-${message.role}`;
  const role = document.createElement('span');
  role.className = 'role';
  role.textContent = message.role === 'user' ? 'you' : 'assistant';
  const content = document.createElement('div');
  content.className = 'content';
  if (message.role === 'assistant') content.append(renderMarkdown(message.content));
  else content.textContent = message.content;
  node.append(role, content);
  return node;
}

function updateTool(node: HTMLElement, activity: Activity, developerMode: boolean): void {
  node.className = 'entry entry-tool';
  node.dataset['callId'] = activity.call.id;
  node.dataset['status'] = activity.status;
  child(node, 'tool-name').textContent = activity.call.toolId;
  child(node, 'tool-status').textContent = STATUS[activity.status];
  const summary = child(node, 'tool-summary');
  summary.textContent = activity.result?.text ?? '';
  summary.hidden = summary.textContent === '';
  const id = child(node, 'tool-id');
  id.hidden = !developerMode;
  id.textContent = developerMode ? `id: ${activity.call.id}` : '';
  const raw = child(node, 'tool-raw', 'pre');
  if (developerMode && activity.result?.data !== undefined) {
    raw.hidden = false;
    raw.textContent = JSON.stringify(activity.result.data, null, 2);
  } else {
    raw.hidden = true;
    raw.textContent = '';
  }
}

function child(parent: HTMLElement, className: string, tag = 'span'): HTMLElement {
  const existing = parent.querySelector(`.${className}`);
  if (existing instanceof HTMLElement) return existing;
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
}

function isNearBottom(root: HTMLElement): boolean {
  return root.scrollHeight - root.scrollTop - root.clientHeight <= NEAR_BOTTOM_PX;
}
