import type { Activity } from '~/core';

const STATUS: Record<Activity['status'], string> = {
  queued: 'Queued',
  'awaiting-confirmation': 'Waiting for confirmation',
  running: 'Running',
  success: 'Success',
  error: 'Error',
  cancelled: 'Cancelled',
};

export function updateToolCard(
  node: HTMLElement,
  activity: Activity,
  developerMode: boolean,
): void {
  node.className = 'tool-card';
  node.dataset['callId'] = activity.call.id;
  const name = child(node, 'tool-name');
  name.textContent = activity.call.toolId;
  const status = child(node, 'tool-status');
  status.textContent =
    activity.status === 'running'
      ? `Using tool: ${activity.call.toolId}…`
      : STATUS[activity.status];
  const summary = child(node, 'tool-summary');
  summary.textContent = activity.result?.text ?? '';
  const raw = child(node, 'tool-raw', 'pre');
  if (developerMode && activity.result?.data !== undefined) {
    raw.hidden = false;
    raw.textContent = JSON.stringify(activity.result.data, null, 2);
  } else {
    raw.hidden = true;
    raw.textContent = '';
  }
}

function child(parent: HTMLElement, className: string, tag = 'div'): HTMLElement {
  const existing = parent.querySelector(`.${className}`);
  if (existing instanceof HTMLElement) return existing;
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
}
