import { createBarParts, type GlyphName } from '~/widget/bar-parts';
import { el, text } from '~/widget/dom';
import { busyCopy, friendlyError } from '~/widget/errors';
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

const COMPOSABLE: ReadonlySet<BarMode['kind']> = new Set(['idle', 'receipt']);
const WORKING: ReadonlySet<BarMode['kind']> = new Set(['busy', 'tool']);

export function createBar(
  root: ParentNode,
  handlers: BarHandlers,
  options: { hotkeyLabel: string },
): Bar {
  const parts = createBarParts(root, options);
  const { input, line, confirm } = parts;
  let current: BarMode = { kind: 'collapsed' };

  function submit(): void {
    const value = input.value.trim();
    if (value === '' || !COMPOSABLE.has(current.kind)) return;
    input.value = '';
    handlers.send(value);
  }

  parts.wire.addEventListener('click', handlers.open);
  parts.close.addEventListener('click', handlers.close);
  parts.send.addEventListener('click', submit);
  parts.stop.addEventListener('click', handlers.stop);
  parts.transcript.addEventListener('click', handlers.transcript);
  input.addEventListener('input', handlers.draft);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  });
  parts.retry.addEventListener('click', () => {
    if (current.kind === 'error' && current.retry !== undefined) handlers.retry(current.retry);
  });
  confirm.cancel.addEventListener('click', () => {
    if (current.kind === 'review')
      handlers.confirm(current.proposal.id, current.proposal.version, false);
  });
  confirm.approve.addEventListener('click', () => {
    if (current.kind === 'review')
      handlers.confirm(current.proposal.id, current.proposal.version, true);
  });

  function showGlyph(name: GlyphName, tone = ''): void {
    for (const [key, node] of Object.entries(parts.glyphs)) {
      node.style.display = key === name ? '' : 'none';
    }
    parts.glyph.className = tone === '' ? 'glyph' : `glyph ${tone}`;
  }

  function syncVisibility(mode: BarMode, tools: number | undefined): void {
    const isConfirm = mode.kind === 'review';
    confirm.root.hidden = !isConfirm;
    parts.glyph.hidden = isConfirm;
    parts.main.hidden = isConfirm;
    parts.right.hidden = isConfirm;
    parts.progress.hidden = !WORKING.has(mode.kind);
    input.readOnly = !COMPOSABLE.has(mode.kind);

    parts.pill.hidden = tools === undefined || !COMPOSABLE.has(mode.kind);
    parts.pill.textContent = tools === undefined ? '' : `${tools} ${plural(tools, 'tool')}`;
    parts.meta.hidden = mode.kind !== 'tool';
    parts.transcript.hidden = mode.kind === 'error' || (mode.kind === 'idle' && !mode.history);
    parts.retry.hidden = mode.kind !== 'error' || mode.retry === undefined;
    parts.send.hidden = !COMPOSABLE.has(mode.kind);
    parts.stop.hidden = !WORKING.has(mode.kind);
    parts.divider.hidden =
      parts.pill.hidden && parts.meta.hidden && parts.transcript.hidden && parts.retry.hidden;
  }

  function syncContent(mode: BarMode): void {
    switch (mode.kind) {
      case 'idle':
        showGlyph('wire');
        line.replaceChildren();
        input.placeholder = mode.history ? 'Follow up…' : 'What do you want to do on this page?';
        parts.send.disabled = mode.draft.trim() === '';
        parts.send.classList.toggle('primary', !parts.send.disabled);
        break;
      case 'busy':
        showGlyph('wire');
        line.replaceChildren(text('span', 'muted shrink', busyCopy()));
        break;
      case 'tool':
        showGlyph('spinner');
        line.replaceChildren(
          text('span', 'tool-name', mode.toolId),
          text('span', 'muted', 'running'),
        );
        parts.meta.textContent = `${mode.index} of ${mode.total}`;
        break;
      case 'receipt':
        showGlyph('check', 'success');
        parts.send.disabled = true;
        parts.send.classList.remove('primary');
        line.replaceChildren(
          receipt(mode.text),
          ...(mode.tools === 0
            ? []
            : [text('span', 'muted', `· ${mode.tools} ${plural(mode.tools, 'tool')}`)]),
        );
        break;
      case 'error':
        showGlyph('error', 'danger');
        line.replaceChildren(
          text('span', 'shrink', friendlyError(mode.code)),
          text('span', 'mono muted', mode.code),
        );
        break;
      case 'review':
        confirm.title.textContent = mode.proposal.title;
        confirm.approve.textContent = 'Confirm';
        break;
    }
  }

  return {
    getDraft: () => input.value,
    focus() {
      if (current.kind === 'collapsed') parts.wire.focus();
      else if (current.kind === 'review') confirm.cancel.focus();
      else input.focus();
    },
    sync(mode, tools, transcriptOpen) {
      const previous = current;
      parts.transcript.setAttribute('aria-expanded', transcriptOpen ? 'true' : 'false');
      current = mode;
      parts.wire.hidden = mode.kind !== 'collapsed';
      parts.bar.hidden = mode.kind === 'collapsed';
      parts.bar.dataset['mode'] = mode.kind;
      if (mode.kind === 'collapsed') return;

      syncVisibility(mode, tools);
      syncContent(mode);

      if (previous.kind === mode.kind) return;
      if (mode.kind === 'review') confirm.cancel.focus();
      else if (previous.kind === 'review' || previous.kind === 'collapsed') input.focus();
    },
  };
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

// The receipt is one line of model output. Markdown renders; CSS flattens blocks to inline.
function receipt(source: string): HTMLElement {
  const node = el('span', 'receipt-text shrink');
  const body = el('span', 'receipt-body');
  body.append(renderMarkdown(source));
  node.append(body);
  return node;
}
