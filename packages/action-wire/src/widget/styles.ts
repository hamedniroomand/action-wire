/**
 * Host CSS variables for the reference widget.
 *
 * --aw-color-accent, --aw-color-accent-strong, --aw-color-accent-text,
 * --aw-color-surface, --aw-color-raised, --aw-color-border, --aw-color-text,
 * --aw-color-muted, --aw-color-user, --aw-color-success, --aw-color-danger,
 * --aw-color-warning, --aw-color-warning-border, --aw-color-warning-text,
 * --aw-radius, --aw-radius-bubble, --aw-radius-full, --aw-shadow,
 * --aw-font, --aw-font-mono,
 * --aw-launcher-size, --aw-avatar-size, --aw-panel-width,
 * --aw-panel-max-height, --aw-space
 */
export const STYLES = `
:host {
  --aw-color-accent: #2563eb;
  --aw-color-accent-strong: #1d4ed8;
  --aw-color-accent-text: #fff;
  --aw-color-surface: #fff;
  --aw-color-raised: #f8fafc;
  --aw-color-border: #e5e7eb;
  --aw-color-text: #111827;
  --aw-color-muted: #6b7280;
  --aw-color-user: #eff6ff;
  --aw-color-success: #16a34a;
  --aw-color-danger: #dc2626;
  --aw-color-warning: #fffbeb;
  --aw-color-warning-border: #fde68a;
  --aw-color-warning-text: #92400e;
  --aw-radius: 16px;
  --aw-radius-bubble: 14px;
  --aw-radius-full: 999px;
  --aw-shadow: 0 10px 30px rgb(15 23 42 / 12%);
  --aw-font: ui-sans-serif, system-ui, sans-serif;
  --aw-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --aw-launcher-size: 56px;
  --aw-avatar-size: 28px;
  --aw-panel-width: 380px;
  --aw-panel-max-height: 640px;
  --aw-space: 12px;
  font-family: var(--aw-font);
  color: var(--aw-color-text);
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

.launcher,
.panel {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 2147483646;
}

.launcher {
  display: grid;
  place-items: center;
  width: var(--aw-launcher-size);
  height: var(--aw-launcher-size);
  padding: 0;
  border: 0;
  border-radius: var(--aw-radius-full);
  background: linear-gradient(135deg, var(--aw-color-accent), var(--aw-color-accent-strong));
  color: var(--aw-color-accent-text);
  box-shadow: 0 8px 24px rgb(37 99 235 / 40%);
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.launcher:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgb(37 99 235 / 48%);
}

.launcher svg {
  width: 26px;
  height: 26px;
}

.launcher[hidden],
.panel[hidden] {
  display: none;
}

.panel {
  display: flex;
  flex-direction: column;
  width: min(var(--aw-panel-width), calc(100vw - 32px));
  max-height: min(var(--aw-panel-max-height), calc(100vh - 32px));
  overflow: hidden;
  background: var(--aw-color-surface);
  border: 1px solid var(--aw-color-border);
  border-radius: var(--aw-radius);
  box-shadow: var(--aw-shadow);
  animation: aw-fade 160ms ease-out;
}

/* Opacity only. A transform would move the panel box and make geometry checks flake. */
@keyframes aw-fade {
  from {
    opacity: 0;
  }
}

.header {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: var(--aw-space);
  border-bottom: 1px solid var(--aw-color-border);
}

.title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.title::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: var(--aw-radius-full);
  background: var(--aw-color-accent);
}

.status {
  color: var(--aw-color-muted);
  font-size: 12px;
}

.close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: var(--aw-radius-full);
  background: transparent;
  color: var(--aw-color-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.close:hover {
  background: var(--aw-color-raised);
  color: var(--aw-color-text);
}

.timeline {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--aw-space);
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 0 0 10px;
}

.message-row-user {
  justify-content: flex-end;
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--aw-avatar-size);
  height: var(--aw-avatar-size);
  border-radius: var(--aw-radius-full);
  background: linear-gradient(135deg, var(--aw-color-accent), var(--aw-color-accent-strong));
  color: var(--aw-color-accent-text);
}

.avatar svg {
  width: 15px;
  height: 15px;
}

.message {
  margin: 0;
  max-width: 85%;
  padding: 9px 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.message-user {
  border-radius: var(--aw-radius-bubble) var(--aw-radius-bubble) 4px var(--aw-radius-bubble);
  background: var(--aw-color-user);
}

.message-assistant {
  border: 1px solid var(--aw-color-border);
  border-radius: var(--aw-radius-bubble) var(--aw-radius-bubble) var(--aw-radius-bubble) 4px;
  background: var(--aw-color-raised);
}

.tool-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 8px;
  margin: 0 0 10px var(--aw-space);
  padding: 10px 12px;
  border: 1px solid var(--aw-color-border);
  border-radius: 12px;
  background: var(--aw-color-surface);
  box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
  font-size: 13px;
}

.tool-name {
  grid-row: 1;
  grid-column: 1;
  color: var(--aw-color-text);
  font-family: var(--aw-font-mono);
  font-weight: 600;
}

.tool-id {
  grid-row: 1;
  grid-column: 2;
  align-self: center;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--aw-color-raised);
  color: var(--aw-color-muted);
  font-family: var(--aw-font-mono);
  font-size: 11px;
}

.tool-status {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 6px;
  color: var(--aw-color-muted);
  font-size: 12px;
}

.tool-status::before {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  font-size: 12px;
  line-height: 1;
}

.tool-card[data-status='queued'] .tool-status::before,
.tool-card[data-status='awaiting-confirmation'] .tool-status::before {
  content: '•';
}

.tool-card[data-status='running'] .tool-status::before {
  content: '';
  width: 12px;
  height: 12px;
  border: 2px solid var(--aw-color-border);
  border-top-color: var(--aw-color-accent);
  border-radius: var(--aw-radius-full);
  animation: aw-spin 700ms linear infinite;
}

.tool-card[data-status='success'] .tool-status::before {
  content: '✓';
  color: var(--aw-color-success);
}

.tool-card[data-status='error'] .tool-status::before {
  content: '✕';
  color: var(--aw-color-danger);
}

.tool-card[data-status='cancelled'] .tool-status::before {
  content: '✕';
}

@keyframes aw-spin {
  to {
    transform: rotate(1turn);
  }
}

.tool-summary {
  grid-column: 1 / -1;
  color: var(--aw-color-text);
  overflow-wrap: anywhere;
}

.tool-summary:empty {
  display: none;
}

.tool-raw {
  grid-column: 1 / -1;
  margin: 4px 0 0;
  padding: 8px;
  border-radius: 8px;
  background: var(--aw-color-raised);
  overflow: auto;
  font-family: var(--aw-font-mono);
  font-size: 11px;
}

.timeline-empty,
.timeline-busy,
.timeline-error {
  margin: 0 0 10px;
  color: var(--aw-color-muted);
  font-size: 13px;
}

.timeline-error {
  padding: 9px 12px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  background: #fef2f2;
  color: #b91c1c;
}

.confirmation {
  flex: none;
  margin: 0 var(--aw-space) var(--aw-space);
  padding: var(--aw-space);
  border: 1px solid var(--aw-color-warning-border);
  border-radius: 12px;
  background: var(--aw-color-warning);
}

.confirmation[hidden] {
  display: none;
}

.confirmation-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
  font-weight: 600;
}

.confirmation-title::before {
  content: '⚠';
  flex: none;
  color: #d97706;
}

.confirmation-warning {
  margin: 0 0 10px;
  padding-left: 22px;
  color: var(--aw-color-warning-text);
  font-size: 13px;
}

.confirmation-warning[hidden] {
  display: none;
}

.confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.confirmation-cancel,
.confirm-action {
  padding: 8px 14px;
  border-radius: 8px;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.confirmation-cancel {
  border: 1px solid var(--aw-color-border);
  background: var(--aw-color-surface);
  color: var(--aw-color-text);
}

.confirm-action {
  border: 0;
  background: var(--aw-color-danger);
  color: #fff;
}

.confirm-action:hover {
  background: #b91c1c;
}

.composer {
  display: flex;
  flex: none;
  align-items: flex-end;
  gap: 8px;
  padding: var(--aw-space);
  padding-bottom: calc(var(--aw-space) + env(safe-area-inset-bottom));
  border-top: 1px solid var(--aw-color-border);
}

.composer textarea {
  flex: 1;
  min-height: 40px;
  max-height: 96px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--aw-color-border);
  border-radius: 12px;
  background: var(--aw-color-raised);
  resize: none;
  font: inherit;
  color: inherit;
}

.composer textarea:focus {
  outline: none;
  border-color: var(--aw-color-accent);
  background: var(--aw-color-surface);
}

.send {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: var(--aw-radius-full);
  background: var(--aw-color-accent);
  color: var(--aw-color-accent-text);
  cursor: pointer;
  transition: background 120ms ease;
}

.send:hover:not(:disabled) {
  background: var(--aw-color-accent-strong);
}

.send svg {
  width: 18px;
  height: 18px;
}

.send:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.hint {
  flex: none;
  margin: 0;
  padding: 0 var(--aw-space) var(--aw-space);
  color: var(--aw-color-muted);
  font-size: 11px;
  text-align: center;
}

@media (max-width: 640px) {
  .panel {
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    max-height: min(var(--aw-panel-max-height), 100dvh);
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: var(--aw-radius) var(--aw-radius) 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .panel::before {
    content: '';
    flex: none;
    width: 36px;
    height: 4px;
    margin: 8px auto 0;
    border-radius: var(--aw-radius-full);
    background: var(--aw-color-border);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}
`;
