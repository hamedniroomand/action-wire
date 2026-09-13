import type { Assistant, AssistantState } from '@webmcp-agent/core';

import { createComposer } from '~/composer';
import { STYLES } from '~/styles';
import { attachTimeline } from '~/timeline';

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
  launcher.append(chatIcon());
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
  const composer = createComposer((text) => {
    if (assistant.getState().busy) return;
    void assistant.send(text);
  });
  panel.append(header, timeline, composer.root);
  shadow.replaceChildren(style, launcher, panel);

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    launcher.hidden = open;
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
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setOpen(false);
  });

  return (state) => {
    panel.setAttribute('aria-busy', state.busy ? 'true' : 'false');
    status.textContent = state.busy ? 'Thinking' : '';
    composer.setBusy(state.busy);
    renderTimeline(state);
  };
}

function chatIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z');
  svg.append(path);
  return svg;
}
