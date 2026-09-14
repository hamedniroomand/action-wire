import { button, el, text, textButton } from '~/widget/dom';
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

export type GlyphName = 'wire' | 'check' | 'warn' | 'error' | 'spinner';

export type BarParts = ReturnType<typeof createBarParts>;

export function createBarParts(root: ParentNode, options: { hotkeyLabel: string }) {
  const wire = createWire(options.hotkeyLabel);
  const glyphs: Record<GlyphName, SVGSVGElement> = {
    wire: wireIcon(),
    check: checkIcon(),
    warn: warnIcon(),
    error: errorIcon(),
    spinner: spinnerIcon(),
  };
  const glyph = el('span', 'glyph');
  glyph.append(...Object.values(glyphs));

  const bar = el('div', 'bar');
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Assistant');
  bar.hidden = true;
  const progress = el('div', 'progress');
  const composer = createComposer();
  const controls = createControls();
  const confirm = createConfirm();

  bar.append(progress, glyph, composer.main, controls.right, confirm.root);
  root.append(wire, bar);

  return { wire, bar, progress, glyph, glyphs, ...composer, ...controls, confirm };
}

function createWire(hotkeyLabel: string): HTMLButtonElement {
  const wire = button('wire', 'Open assistant');
  const tab = el('span', 'wire-tab');
  tab.append(wireIcon(), text('span', '', 'Ask this page'), text('span', 'kbd', hotkeyLabel));
  wire.append(tab);
  wire.hidden = true;
  return wire;
}

function createComposer() {
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
  return { main, line, input };
}

function createControls() {
  const right = el('div', 'right');
  const pill = text('span', 'pill', '');
  const meta = text('span', 'muted', '');
  const transcript = button('tbtn ghost transcript-toggle');
  transcript.setAttribute('aria-expanded', 'false');
  transcript.append(text('span', '', 'Transcript'), upIcon());
  const retry = textButton('tbtn', 'Retry');
  const divider = el('span', 'divider');
  const send = button('ibtn', 'Send');
  send.append(sendIcon());
  const stop = button('ibtn stop', 'Stop');
  stop.append(stopIcon());
  const close = button('ibtn', 'Close assistant');
  close.append(closeIcon());
  right.append(pill, meta, transcript, retry, divider, send, stop, close);
  return { right, pill, meta, transcript, retry, divider, send, stop, close };
}

function createConfirm() {
  const root = el('div', 'confirm');
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-labelledby', 'aw-confirm-title');
  root.hidden = true;
  const glyph = el('span', 'glyph warn');
  glyph.append(warnIcon());
  const title = text('span', 'line', '');
  title.id = 'aw-confirm-title';
  const actions = el('div', 'right');
  const cancel = textButton('tbtn', 'Cancel');
  const approve = textButton('tbtn danger', '');
  actions.append(cancel, approve);
  root.append(glyph, title, actions);
  return { root, title, cancel, approve };
}
