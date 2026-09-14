import { busyCopy, friendlyError } from '~/widget/errors';
import {
  checkIcon,
  closeIcon,
  errorIcon,
  sendIcon,
  spinnerIcon,
  stopIcon,
  upIcon,
  warnIcon,
  wireIcon,
} from '~/widget/icons';
import { renderMarkdown } from '~/widget/markdown';
import type { BarMode } from '~/widget/modes';

export type BarHandlers = {
  open: () => void;
  close: () => void;
  send: (text: string) => void;
  stop: () => void;
  retry: (text: string) => void;
  confirm: (id: string, version: number, approved: boolean) => void;
  transcript: () => void;
  draft: () => void;
};

export type Bar = {
  sync(mode: BarMode, tools: number | undefined, transcriptOpen: boolean): void;
  getDraft(): string;
  focus(): void;
};

export function createBar(
  root: ParentNode,
  handlers: BarHandlers,
  options: { hotkeyLabel: string },
): Bar {
  // Collapsed: the wire.
  const wire = button('wire', 'Open assistant');
  const tab = el('span', 'wire-tab');
  tab.append(
    wireIcon(),
    text('span', '', 'Ask this page'),
    text('span', 'kbd', options.hotkeyLabel),
  );
  wire.append(tab);
  wire.hidden = true;

  // Open: the bar.
  const bar = el('div', 'bar');
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Assistant');
  bar.hidden = true;
  const progress = el('div', 'progress');
  const glyph = el('span', 'glyph');
  const glyphs = {
    wire: wireIcon(),
    check: checkIcon(),
    warn: warnIcon(),
    error: errorIcon(),
    spinner: spinnerIcon(),
  };
  glyph.append(...Object.values(glyphs));

  const main = el('div', 'main');
  const line = el('span', 'line');
  line.setAttribute('role', 'status');
  line.setAttribute('aria-live', 'polite');
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'text';
  input.setAttribute('aria-label', 'Message');
  input.placeholder = 'What do you want to do on this page?';
  input.autocomplete = 'off';
  main.append(line, input);

  const right = el('div', 'right');
  const pill = text('span', 'pill', '');
  const meta = text('span', 'muted', '');
  const transcript = button('tbtn ghost transcript-toggle', undefined);
  transcript.setAttribute('aria-expanded', 'false');
  transcript.append(text('span', '', 'Transcript'), upIcon());
  const retry = text('button', 'tbtn', 'Retry');
  retry.type = 'button';
  const divider = el('span', 'divider');
  const send = button('ibtn', 'Send');
  send.append(sendIcon());
  const stop = button('ibtn stop', 'Stop');
  stop.append(stopIcon());
  const close = button('ibtn', 'Close assistant');
  close.append(closeIcon());
  right.append(pill, meta, transcript, retry, divider, send, stop, close);

  // Confirmation replaces the bar content.
  const confirm = el('div', 'confirm');
  confirm.setAttribute('role', 'alertdialog');
  confirm.setAttribute('aria-labelledby', 'aw-confirm-title');
  confirm.hidden = true;
  const confirmGlyph = el('span', 'glyph warn');
  confirmGlyph.append(warnIcon());
  const confirmTitle = text('span', 'line', '');
  confirmTitle.id = 'aw-confirm-title';
  const confirmRight = el('div', 'right');
  const cancel = text('button', 'tbtn', 'Cancel');
  cancel.type = 'button';
  const approve = text('button', 'tbtn danger', '');
  approve.type = 'button';
  confirmRight.append(cancel, approve);
  confirm.append(confirmGlyph, confirmTitle, confirmRight);

  bar.append(progress, glyph, main, right, confirm);
  root.append(wire, bar);

  let current: BarMode = { kind: 'collapsed' };

  function submit(): void {
    const value = input.value.trim();
    if (value === '' || (current.kind !== 'idle' && current.kind !== 'receipt')) return;
    input.value = '';
    handlers.send(value);
  }

  wire.addEventListener('click', handlers.open);
  close.addEventListener('click', handlers.close);
  send.addEventListener('click', submit);
  stop.addEventListener('click', handlers.stop);
  transcript.addEventListener('click', handlers.transcript);
  input.addEventListener('input', handlers.draft);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  });
  retry.addEventListener('click', () => {
    if (current.kind === 'error' && current.retry !== undefined) handlers.retry(current.retry);
  });
  cancel.addEventListener('click', () => {
    if (current.kind === 'review')
      handlers.confirm(current.proposal.id, current.proposal.version, false);
  });
  approve.addEventListener('click', () => {
    if (current.kind === 'review')
      handlers.confirm(current.proposal.id, current.proposal.version, true);
  });

  function showGlyph(name: keyof typeof glyphs, tone = ''): void {
    for (const [key, node] of Object.entries(glyphs)) {
      node.style.display = key === name ? '' : 'none';
    }
    glyph.className = tone === '' ? 'glyph' : `glyph ${tone}`;
  }

  function setLine(...parts: HTMLElement[]): void {
    line.replaceChildren(...parts);
  }

  return {
    getDraft: () => input.value,
    focus() {
      if (current.kind === 'collapsed') wire.focus();
      else if (current.kind === 'review') cancel.focus();
      else input.focus();
    },
    sync(mode, tools, transcriptOpen) {
      const previous = current;
      transcript.setAttribute('aria-expanded', transcriptOpen ? 'true' : 'false');
      current = mode;
      wire.hidden = mode.kind !== 'collapsed';
      bar.hidden = mode.kind === 'collapsed';
      bar.dataset['mode'] = mode.kind;
      if (mode.kind === 'collapsed') return;

      const isConfirm = mode.kind === 'review';
      confirm.hidden = !isConfirm;
      glyph.hidden = isConfirm;
      main.hidden = isConfirm;
      right.hidden = isConfirm;
      progress.hidden = mode.kind !== 'busy' && mode.kind !== 'tool';
      input.readOnly = mode.kind !== 'idle' && mode.kind !== 'receipt';

      pill.hidden = tools === undefined || (mode.kind !== 'idle' && mode.kind !== 'receipt');
      pill.textContent = tools === undefined ? '' : `${tools} ${tools === 1 ? 'tool' : 'tools'}`;
      meta.hidden = mode.kind !== 'tool';
      transcript.hidden = mode.kind === 'error' || (mode.kind === 'idle' && !mode.history);
      retry.hidden = mode.kind !== 'error' || mode.retry === undefined;
      send.hidden = mode.kind !== 'idle' && mode.kind !== 'receipt';
      stop.hidden = mode.kind !== 'busy' && mode.kind !== 'tool';
      divider.hidden = pill.hidden && meta.hidden && transcript.hidden && retry.hidden;

      switch (mode.kind) {
        case 'idle':
          showGlyph('wire');
          setLine();
          input.placeholder = mode.history ? 'Follow up…' : 'What do you want to do on this page?';
          send.disabled = mode.draft.trim() === '';
          send.classList.toggle('primary', !send.disabled);
          break;
        case 'busy':
          showGlyph('wire');
          setLine(text('span', 'muted shrink', busyCopy()));
          break;
        case 'tool':
          showGlyph('spinner');
          setLine(text('span', 'tool-name', mode.toolId), text('span', 'muted', 'running'));
          meta.textContent = `${mode.index} of ${mode.total}`;
          break;
        case 'receipt':
          showGlyph('check', 'success');
          send.disabled = true;
          send.classList.remove('primary');
          setLine(
            receipt(mode.text),
            ...(mode.tools === 0
              ? []
              : [text('span', 'muted', `· ${mode.tools} ${mode.tools === 1 ? 'tool' : 'tools'}`)]),
          );
          break;
        case 'error':
          showGlyph('error', 'danger');
          setLine(
            text('span', 'shrink', friendlyError(mode.code)),
            text('span', 'mono muted', mode.code),
          );
          break;
        case 'review':
          confirmTitle.textContent = mode.proposal.title;
          approve.textContent = 'Confirm';
          break;
      }

      if (previous.kind !== mode.kind) {
        if (mode.kind === 'review') cancel.focus();
        else if (previous.kind === 'review' || previous.kind === 'collapsed') input.focus();
      }
    },
  };
}

// The receipt is one line of model output. Markdown renders; CSS flattens blocks to inline.
function receipt(source: string): HTMLElement {
  const node = el('span', 'receipt-text shrink');
  const body = el('span', 'receipt-body');
  body.append(renderMarkdown(source));
  node.append(body);
  return node;
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function text<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
}

function button(className: string, label: string | undefined): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  if (label !== undefined) node.setAttribute('aria-label', label);
  return node;
}
