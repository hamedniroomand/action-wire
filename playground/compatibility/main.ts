import type { ProbeReport } from './probe';
import { runProbe } from './probe';

const button = document.querySelector<HTMLButtonElement>('#run')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const checks = document.querySelector<HTMLUListElement>('#checks')!;
const output = document.querySelector<HTMLPreElement>('#report')!;

button.addEventListener('click', async () => {
  button.disabled = true;
  status.removeAttribute('data-status');
  status.textContent = 'Running the probe…';
  checks.replaceChildren();
  output.textContent = 'Running';
  try {
    const report = await runProbe();
    // The Playwright report reads this element as JSON. Keep it raw and visible.
    output.textContent = JSON.stringify(report, null, 2);
    status.dataset['status'] = report.status;
    status.textContent = `${LABEL[report.status]} ${report.message}`;
    checks.replaceChildren(...rows(report));
  } finally {
    button.disabled = false;
  }
});

const LABEL: Record<ProbeReport['status'], string> = {
  supported: 'Supported.',
  unsupported: 'Not supported.',
  failed: 'Failed.',
};

function rows(report: ProbeReport): HTMLLIElement[] {
  const missing = Object.entries(report.api)
    .filter(([, type]) => type !== 'function')
    .map(([name]) => name);
  const list: HTMLLIElement[] = [
    row('Secure context', report.secureContext),
    row('document.modelContext methods', missing.length === 0, missing.join(', ') || 'all present'),
    row('Tool registered', report.registeredBeforeDiscovery),
    row('Tool discovered', report.tool !== undefined, report.tool?.name),
    row('Handler ran once', report.handlerCalls === 1, `${report.handlerCalls} call(s)`),
    row('Echo result matched', report.result !== undefined && report.status !== 'failed'),
    row('toolchange on register', report.registrationEvent),
    row('Tool removed after abort', report.removedAfterAbort),
    row('toolchange on remove', report.removalEvent),
    row('Input encoding', report.inputEncoding !== undefined, report.inputEncoding),
  ];
  return list;
}

/** An undefined state means the probe stopped before it reached this step. */
function row(label: string, state: boolean | undefined, value?: string): HTMLLIElement {
  const item = document.createElement('li');
  if (state !== undefined) item.dataset['state'] = state ? 'pass' : 'fail';
  item.append(label);
  if (value !== undefined && value !== '') {
    const detail = document.createElement('span');
    detail.className = 'value';
    detail.textContent = value;
    item.append(detail);
  }
  return item;
}
