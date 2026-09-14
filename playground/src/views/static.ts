import { heading, text } from '../dom';

export function billingView(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(
    heading('Billing', 'Manage invoices for this workspace.'),
    text('p', '', 'No invoices in this session.'),
  );
  return fragment;
}

export function settingsView(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(
    heading('Settings', 'Session preferences stay in memory.'),
    text('p', '', 'Refresh the page to clear projects and the assistant transcript.'),
  );
  return fragment;
}
