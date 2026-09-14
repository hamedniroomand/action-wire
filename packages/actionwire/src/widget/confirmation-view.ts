import type { Assistant, AssistantState } from '~/core';

const WARNINGS = { Delete: 'This action cannot be undone.' } as const;

export function attachConfirmation(assistant: Assistant): {
  root: HTMLElement;
  sync: (state: AssistantState) => void;
} {
  const root = document.createElement('div');
  root.className = 'confirmation';
  root.hidden = true;
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-labelledby', 'wa-confirm-title');
  root.setAttribute('aria-describedby', 'wa-confirm-warning');
  const title = document.createElement('p');
  title.id = 'wa-confirm-title';
  title.className = 'confirmation-title';
  const warning = document.createElement('p');
  warning.id = 'wa-confirm-warning';
  warning.className = 'confirmation-warning';
  const actions = document.createElement('div');
  actions.className = 'confirmation-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'confirmation-cancel';
  cancel.textContent = 'Cancel';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'confirm-action';
  actions.append(cancel, confirm);
  root.append(title, warning, actions);
  let visible = false;

  cancel.addEventListener('click', () => {
    const id = assistant.getState().confirmation?.id;
    if (id !== undefined) assistant.confirm(id, false);
  });
  confirm.addEventListener('click', () => {
    const id = assistant.getState().confirmation?.id;
    if (id !== undefined) assistant.confirm(id, true);
  });

  return {
    root,
    sync(state) {
      const prompt = state.confirmation;
      if (prompt === undefined) {
        root.hidden = true;
        visible = false;
        return;
      }
      root.hidden = false;
      title.textContent = prompt.title;
      confirm.textContent = prompt.confirmLabel;
      const warningText = prompt.confirmLabel === 'Delete' ? WARNINGS.Delete : '';
      warning.hidden = warningText === '';
      warning.textContent = warningText;
      if (!visible) cancel.focus();
      visible = true;
    },
  };
}
