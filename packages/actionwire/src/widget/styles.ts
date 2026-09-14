/**
 * Host CSS variables.
 *
 * --aw-color-accent, --aw-color-accent-strong, --aw-color-accent-text,
 * --aw-color-surface, --aw-color-raised, --aw-color-border, --aw-color-text,
 * --aw-color-muted, --aw-color-success, --aw-color-danger,
 * (every colour is light-dark(); data-theme on the host picks the scheme)
 * --aw-color-warning, --aw-color-warning-border, --aw-color-warning-text,
 * --aw-color-danger-border, --aw-color-danger-text, --aw-color-shadow, --aw-color-focus,
 * --aw-radius, --aw-radius-full, --aw-shadow, --aw-font, --aw-font-mono,
 * --aw-bar-width, --aw-bar-height, --aw-bar-bottom, --aw-transcript-max-height
 */
export const STYLES = `
:host {
  color-scheme: light dark;
  --aw-color-accent: light-dark(#2563eb, #60a5fa);
  --aw-color-accent-strong: light-dark(#1d4ed8, #3b82f6);
  --aw-color-accent-text: light-dark(#fff, #0b1220);
  --aw-color-surface: light-dark(#fff, #111827);
  --aw-color-raised: light-dark(#f8fafc, #1f2937);
  --aw-color-border: light-dark(#e5e7eb, #374151);
  --aw-color-text: light-dark(#111827, #f3f4f6);
  --aw-color-muted: light-dark(#6b7280, #9ca3af);
  --aw-color-success: light-dark(#16a34a, #4ade80);
  --aw-color-danger: light-dark(#dc2626, #f87171);
  --aw-color-danger-border: light-dark(#fecaca, #7f1d1d);
  --aw-color-danger-text: #fff;
  --aw-color-warning: light-dark(#fffbeb, #422006);
  --aw-color-warning-border: light-dark(#fde68a, #854d0e);
  --aw-color-warning-text: light-dark(#92400e, #fde68a);
  --aw-color-shadow: light-dark(rgb(15 23 42 / 12%), rgb(0 0 0 / 45%));
  --aw-color-focus: light-dark(rgb(37 99 235 / 15%), rgb(96 165 250 / 25%));
  --aw-radius: 12px;
  --aw-radius-full: 999px;
  --aw-shadow: 0 10px 30px var(--aw-color-shadow);
  --aw-font: ui-sans-serif, system-ui, sans-serif;
  --aw-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --aw-bar-width: 640px;
  --aw-bar-height: 40px;
  --aw-bar-bottom: 12px;
  --aw-transcript-max-height: 320px;
  font-family: var(--aw-font);
  color: var(--aw-color-text);
  font-size: 13.5px;
  line-height: 1.4;
}

:host([data-theme='light']) {
  color-scheme: light;
}

:host([data-theme='dark']) {
  color-scheme: dark;
}

:host *,
:host *::before,
:host *::after {
  box-sizing: border-box;
}

:host :focus-visible {
  outline: 2px solid var(--aw-color-accent);
  outline-offset: 2px;
}

/* The bar signals focus. The input inside it does not draw its own ring. */
.input:focus-visible {
  outline: none;
}

.bar:focus-within {
  border-color: var(--aw-color-accent);
  box-shadow: var(--aw-shadow), 0 0 0 3px var(--aw-color-focus);
}

/* Class rules below set display. This keeps the hidden attribute authoritative. */
:host [hidden] {
  display: none !important;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.root {
  position: fixed;
  left: 50%;
  bottom: 0;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(var(--aw-bar-width), 100vw - 24px);
  transform: translateX(-50%);
  pointer-events: none;
}

.root > * {
  pointer-events: auto;
}

/* Collapsed: the wire. */
.wire {
  position: relative;
  width: 96px;
  height: 24px;
}

.wire::before {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--aw-color-accent);
}

.wire::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -3px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: var(--aw-radius-full);
  background: var(--aw-color-accent);
}

.wire-tab {
  position: absolute;
  left: 50%;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--aw-color-border);
  border-bottom: 0;
  border-top: 2px solid var(--aw-color-accent);
  border-radius: 10px 10px 0 0;
  background: var(--aw-color-surface);
  box-shadow: 0 -6px 18px var(--aw-color-shadow);
  font-size: 12.5px;
  white-space: nowrap;
  color: var(--aw-color-text);
  opacity: 0;
  transform: translate(-50%, 100%);
  transition: transform 160ms ease-out, opacity 160ms ease-out;
}

.wire:hover .wire-tab,
.wire:focus-visible .wire-tab {
  opacity: 1;
  transform: translate(-50%, 0);
}

.kbd {
  font: 11px var(--aw-font-mono);
  color: var(--aw-color-muted);
  border: 1px solid var(--aw-color-border);
  border-radius: 5px;
  padding: 1px 5px;
  background: var(--aw-color-raised);
}

/* Open: the bar. */
.bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: var(--aw-bar-height);
  margin-bottom: max(var(--aw-bar-bottom), env(safe-area-inset-bottom));
  padding: 0 6px 0 14px;
  border: 1px solid var(--aw-color-border);
  border-radius: var(--aw-radius);
  background: var(--aw-color-surface);
  box-shadow: var(--aw-shadow);
  transform-origin: bottom center;
  animation: aw-open 180ms ease-out;
}

@keyframes aw-open {
  from {
    opacity: 0;
    transform: scaleY(0.05);
  }
}

.bar[data-mode='confirm'] {
  background: var(--aw-color-warning);
  border-color: var(--aw-color-warning-border);
}

.confirm {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.bar[data-mode='error'] {
  border-color: var(--aw-color-danger-border);
}

.progress {
  position: absolute;
  left: 12px;
  right: 12px;
  top: -1px;
  height: 2px;
  border-radius: 2px;
  overflow: hidden;
}

.progress::before {
  content: '';
  position: absolute;
  top: 0;
  left: -40%;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--aw-color-accent) 30%, var(--aw-color-accent) 70%, transparent);
  animation: aw-progress 1.2s ease-in-out infinite;
}

@keyframes aw-progress {
  to {
    left: 100%;
  }
}

.glyph {
  display: inline-flex;
  flex: none;
  color: var(--aw-color-accent);
}

.glyph.success { color: var(--aw-color-success); }
.glyph.warn { color: var(--aw-color-warning-text); }
.glyph.danger { color: var(--aw-color-danger); }

.main {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
  color: var(--aw-color-text);
  outline: none;
}

.input::placeholder {
  color: var(--aw-color-muted);
}

/* The input stays focusable in every mode so the first keystroke returns to idle. */
.bar:not([data-mode='idle']) .input {
  opacity: 0;
}

.line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Only the long text shrinks. Counts, codes, and the caret keep their size. */
.line > span {
  flex: none;
}

.line > .shrink {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar[data-mode='idle'] .line {
  display: none;
}

/* One line of Markdown: blocks become inline, type inherits, lists lose bullets. */
.receipt-text {
  display: flex;
  align-items: center;
}

.receipt-body {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.receipt-body > * {
  display: inline;
  margin: 0;
  padding: 0;
  font: inherit;
}

.receipt-text li {
  list-style: none;
}

/* The reply is where typing continues. The caret follows the ellipsis, outside the clipped body. */
.bar[data-mode='receipt']:focus-within .receipt-text::after {
  content: '';
  flex: none;
  width: 1.5px;
  height: 1em;
  margin-left: 3px;
  background: var(--aw-color-accent);
  animation: aw-blink 1s steps(1) infinite;
}

@keyframes aw-blink {
  50% {
    opacity: 0;
  }
}

.receipt-text code {
  font: 12.5px var(--aw-font-mono);
  background: var(--aw-color-raised);
  border-radius: 4px;
  padding: 1px 4px;
}

.receipt-text a {
  color: var(--aw-color-accent);
}

.bar[data-mode='confirm'] .line {
  color: var(--aw-color-warning-text);
  font-size: 13px;
}

.mono,
.tool-name {
  font-family: var(--aw-font-mono);
  font-size: 12.5px;
}

.muted {
  color: var(--aw-color-muted);
  font-size: 12px;
}

.right {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex: none;
}

.pill {
  font: 11px var(--aw-font-mono);
  color: var(--aw-color-muted);
  background: var(--aw-color-raised);
  border: 1px solid var(--aw-color-border);
  border-radius: var(--aw-radius-full);
  padding: 3px 8px;
  white-space: nowrap;
}

@media (max-width: 400px) {
  .pill {
    display: none;
  }
}

.divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--aw-color-border);
}

.ibtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--aw-color-muted);
}

.ibtn:hover {
  background: var(--aw-color-raised);
  color: var(--aw-color-text);
}

.ibtn:disabled {
  opacity: 0.4;
  cursor: default;
  background: none;
}

.ibtn.primary {
  background: var(--aw-color-accent);
  color: var(--aw-color-accent-text);
}

.ibtn.primary:hover {
  background: var(--aw-color-accent-strong);
}

.ibtn.stop {
  background: var(--aw-color-text);
  color: var(--aw-color-surface);
}

.tbtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--aw-color-border);
  border-radius: 8px;
  background: var(--aw-color-surface);
  font-size: 12.5px;
  color: var(--aw-color-text);
  white-space: nowrap;
}

.tbtn:hover {
  background: var(--aw-color-raised);
}

.tbtn.ghost {
  border-color: transparent;
  background: transparent;
  color: var(--aw-color-muted);
}

/* The chevron points at where the transcript will go. */
.transcript-toggle svg {
  transition: transform 160ms ease-out;
}

.transcript-toggle[aria-expanded='true'] svg {
  transform: rotate(180deg);
}

.tbtn.danger {
  border-color: var(--aw-color-danger);
  background: var(--aw-color-danger);
  color: var(--aw-color-danger-text);
  font-weight: 600;
}

.spin {
  animation: aw-spin 0.9s linear infinite;
}

@keyframes aw-spin {
  to {
    transform: rotate(360deg);
  }
}

/* The transcript sheet. */
.transcript {
  width: 100%;
  max-height: var(--aw-transcript-max-height);
  margin-bottom: 8px;
  padding: 14px 18px;
  overflow-y: auto;
  border: 1px solid var(--aw-color-border);
  border-radius: var(--aw-radius);
  background: var(--aw-color-surface);
  box-shadow: var(--aw-shadow);
  animation: aw-rise 160ms ease-out;
}

@keyframes aw-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.transcript-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aw-color-muted);
}

.transcript-head > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.entries {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-left: 22px;
}

.entries::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 6px;
  bottom: 6px;
  width: 1.5px;
  background: var(--aw-color-border);
}

.entry {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.entry::before {
  content: '';
  position: absolute;
  left: -22px;
  top: 5px;
  width: 8px;
  height: 8px;
  border-radius: var(--aw-radius-full);
  background: var(--aw-color-accent);
}

.entry-user::before {
  width: 5px;
  height: 5px;
  border: 1.5px solid var(--aw-color-muted);
  background: var(--aw-color-surface);
}

.role {
  font: 11px var(--aw-font-mono);
  color: var(--aw-color-muted);
}

.entry-tool {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.tool-status {
  margin-left: auto;
  font-size: 12px;
  color: var(--aw-color-muted);
}

.entry-tool[data-status='success'] .tool-status { color: var(--aw-color-success); }
.entry-tool[data-status='error'] .tool-status { color: var(--aw-color-danger); }

.tool-summary,
.tool-id,
.tool-raw {
  flex-basis: 100%;
  font-size: 12.5px;
  color: var(--aw-color-muted);
}

.tool-id,
.tool-raw {
  font: 11px var(--aw-font-mono);
}

.tool-raw {
  margin: 0;
  padding: 8px;
  border-radius: 6px;
  background: var(--aw-color-raised);
  white-space: pre-wrap;
}

.content > :first-child { margin-top: 0; }
.content > :last-child { margin-bottom: 0; }
.content p, .content ul, .content ol { margin: 0 0 6px; }
.content ul, .content ol { padding-left: 20px; }
.content pre {
  margin: 6px 0;
  padding: 8px;
  border-radius: 6px;
  background: var(--aw-color-raised);
  font: 12px var(--aw-font-mono);
  overflow-x: auto;
}
.content code { font: 12px var(--aw-font-mono); background: var(--aw-color-raised); border-radius: 4px; padding: 1px 4px; }
.content pre code { background: none; padding: 0; }
.content a { color: var(--aw-color-accent); }

@media (prefers-reduced-motion: reduce) {
  .bar,
  .transcript,
  .progress::before,
  .spin,
  .wire-tab,
  .receipt-text::after,
  .transcript-toggle svg {
    animation: none;
    transition: none;
  }
}
`;
