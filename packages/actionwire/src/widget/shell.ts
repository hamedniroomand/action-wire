import type { Assistant, AssistantState } from '~/core';
import { createComposer } from '~/widget/composer';
import { attachConfirmation } from '~/widget/confirmation-view';
import { sparkIcon } from '~/widget/icons';
import { STYLES } from '~/widget/styles';
import { attachTimeline } from '~/widget/timeline';

export function attachShell(
  shadow: ShadowRoot,
  assistant: Assistant,
  developerMode: boolean,
): (state: AssistantState) => void {
  const style = document.createElement('style');
  style.textContent = STYLES;
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'launcher';
  launcher.setAttribute('aria-label', 'Open assistant');
  launcher.append(sparkIcon());
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'wa-title');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-busy', 'false');
  const header = document.createElement('div');
  header.className = 'header';
  const title = document.createElement('h2');
  title.id = 'wa-title';
  title.className = 'title';
  title.textContent = 'Assistant';
  const status = document.createElement('span');
  status.className = 'status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.setAttribute('aria-label', 'Close assistant');
  close.textContent = '×';
  header.append(title, status, close);
  const timeline = document.createElement('div');
  timeline.className = 'timeline';
  const renderTimeline = attachTimeline(timeline, { developerMode });
  const confirmation = attachConfirmation(assistant);
  const composer = createComposer((text) => {
    if (assistant.getState().busy) return;
    void assistant.send(text);
  });
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'The assistant can use the tools on this page.';
  panel.append(header, timeline, confirmation.root, composer.root, hint);
  shadow.replaceChildren(style, launcher, panel);

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    launcher.hidden = open;
    if (open) {
      const field = panel.querySelector('textarea');
      if (field instanceof HTMLTextAreaElement) field.focus();
      return;
    }
    launcher.focus();
  }

  launcher.addEventListener('click', () => {
    setOpen(true);
  });
  launcher.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setOpen(true);
  });
  close.addEventListener('click', () => {
    setOpen(false);
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      const prompt = assistant.getState().confirmation;
      if (prompt !== undefined) {
        assistant.confirm(prompt.id, false);
        return;
      }
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') trapFocus(panel, event);
  });

  return (state) => {
    panel.setAttribute('aria-busy', state.busy ? 'true' : 'false');
    status.textContent = state.busy ? 'Thinking' : '';
    composer.setBusy(state.busy);
    renderTimeline(state);
    confirmation.sync(state);
  };
}

function trapFocus(root: HTMLElement, event: KeyboardEvent): void {
  const items = [...root.querySelectorAll('button, textarea')].filter(
    (node): node is HTMLElement => {
      if (!(node instanceof HTMLElement) || node.closest('[hidden]') !== null) return false;
      return !isDisabled(node);
    },
  );
  const first = items[0];
  const last = items.at(-1);
  if (first === undefined || last === undefined) return;
  const scope = root.getRootNode();
  const active = scope instanceof ShadowRoot ? scope.activeElement : undefined;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function isDisabled(node: HTMLElement): boolean {
  return (
    (node instanceof HTMLButtonElement || node instanceof HTMLTextAreaElement) && node.disabled
  );
}
