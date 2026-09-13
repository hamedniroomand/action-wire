/**
 * Host CSS variables for the reference widget.
 *
 * --aw-color-accent, --aw-color-accent-text, --aw-color-surface,
 * --aw-color-border, --aw-color-text, --aw-color-muted, --aw-color-user,
 * --aw-radius, --aw-radius-full, --aw-shadow, --aw-font,
 * --aw-launcher-size, --aw-panel-width, --aw-panel-max-height, --aw-space
 */
export const STYLES = `
:host {
  --aw-color-accent: #2563eb;
  --aw-color-accent-text: #fff;
  --aw-color-surface: #fff;
  --aw-color-border: #e5e7eb;
  --aw-color-text: #111827;
  --aw-color-muted: #6b7280;
  --aw-color-user: #eff6ff;
  --aw-radius: 16px;
  --aw-radius-full: 999px;
  --aw-shadow: 0 10px 30px rgb(15 23 42 / 12%);
  --aw-font: ui-sans-serif, system-ui, sans-serif;
  --aw-launcher-size: 56px;
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
  background: var(--aw-color-accent);
  color: var(--aw-color-accent-text);
  box-shadow: var(--aw-shadow);
  cursor: pointer;
}

.launcher svg {
  width: 24px;
  height: 24px;
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
  margin: 0;
  flex: 1;
  font-size: 16px;
  font-weight: 600;
}

.status {
  color: var(--aw-color-muted);
  font-size: 12px;
}

.close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--aw-radius-full);
  background: transparent;
  color: var(--aw-color-text);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.timeline {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--aw-space);
}

.composer {
  display: flex;
  flex: none;
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
  padding: 8px 10px;
  border: 1px solid var(--aw-color-border);
  border-radius: 12px;
  resize: none;
  font: inherit;
  color: inherit;
}

.send {
  padding: 8px 12px;
  border: 0;
  border-radius: 12px;
  background: var(--aw-color-accent);
  color: var(--aw-color-accent-text);
  font: inherit;
  cursor: pointer;
}

.send:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.message {
  margin: 0 0 8px;
  max-width: 90%;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.message-user {
  margin-left: auto;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--aw-color-user);
}

.tool-card {
  margin: 0 0 8px;
  padding: 8px 10px;
  border: 1px solid var(--aw-color-border);
  border-radius: 12px;
  background: #f9fafb;
  color: var(--aw-color-muted);
  font-size: 13px;
}

.tool-name {
  color: var(--aw-color-text);
  font-weight: 600;
}

.tool-raw {
  margin: 8px 0 0;
  overflow: auto;
  font-size: 12px;
}

.timeline-empty,
.timeline-busy,
.timeline-error {
  margin: 0 0 8px;
  color: var(--aw-color-muted);
}

.timeline-error {
  color: #b91c1c;
}

.confirmation {
  flex: none;
  margin: 0 var(--aw-space) var(--aw-space);
  padding: var(--aw-space);
  border: 1px solid var(--aw-color-border);
  border-radius: 12px;
  background: #fff7ed;
}

.confirmation[hidden] {
  display: none;
}

.confirmation-title,
.confirmation-warning {
  margin: 0 0 8px;
}

.confirmation-warning {
  color: #9a3412;
  font-size: 13px;
}

.confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.confirmation-cancel,
.confirm-action {
  padding: 8px 12px;
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}

.confirmation-cancel {
  border: 1px solid var(--aw-color-border);
  background: var(--aw-color-surface);
}

.confirm-action {
  border: 0;
  background: #b91c1c;
  color: #fff;
}

@media (max-width: 640px) {
  .panel {
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    max-height: min(var(--aw-panel-max-height), 100dvh);
    border-radius: var(--aw-radius) var(--aw-radius) 0 0;
    padding-bottom: env(safe-area-inset-bottom);
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
