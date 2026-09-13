/**
 * Host CSS variables for the reference widget.
 *
 * --wa-color-accent, --wa-color-accent-text, --wa-color-surface,
 * --wa-color-border, --wa-color-text, --wa-color-muted, --wa-color-user,
 * --wa-radius, --wa-radius-full, --wa-shadow, --wa-font,
 * --wa-launcher-size, --wa-panel-width, --wa-panel-max-height, --wa-space
 */
export const STYLES = `
:host {
  --wa-color-accent: #2563eb;
  --wa-color-accent-text: #fff;
  --wa-color-surface: #fff;
  --wa-color-border: #e5e7eb;
  --wa-color-text: #111827;
  --wa-color-muted: #6b7280;
  --wa-color-user: #eff6ff;
  --wa-radius: 16px;
  --wa-radius-full: 999px;
  --wa-shadow: 0 10px 30px rgb(15 23 42 / 12%);
  --wa-font: ui-sans-serif, system-ui, sans-serif;
  --wa-launcher-size: 56px;
  --wa-panel-width: 380px;
  --wa-panel-max-height: 640px;
  --wa-space: 12px;
  font-family: var(--wa-font);
  color: var(--wa-color-text);
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
  width: var(--wa-launcher-size);
  height: var(--wa-launcher-size);
  padding: 0;
  border: 0;
  border-radius: var(--wa-radius-full);
  background: var(--wa-color-accent);
  color: var(--wa-color-accent-text);
  box-shadow: var(--wa-shadow);
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
  width: min(var(--wa-panel-width), calc(100vw - 32px));
  max-height: min(var(--wa-panel-max-height), calc(100vh - 32px));
  overflow: hidden;
  background: var(--wa-color-surface);
  border: 1px solid var(--wa-color-border);
  border-radius: var(--wa-radius);
  box-shadow: var(--wa-shadow);
}

.header {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: var(--wa-space);
  border-bottom: 1px solid var(--wa-color-border);
}

.title {
  margin: 0;
  flex: 1;
  font-size: 16px;
  font-weight: 600;
}

.status {
  color: var(--wa-color-muted);
  font-size: 12px;
}

.close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--wa-radius-full);
  background: transparent;
  color: var(--wa-color-text);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.timeline {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--wa-space);
}

.composer {
  display: flex;
  flex: none;
  gap: 8px;
  padding: var(--wa-space);
  padding-bottom: calc(var(--wa-space) + env(safe-area-inset-bottom));
  border-top: 1px solid var(--wa-color-border);
}

.composer textarea {
  flex: 1;
  min-height: 40px;
  max-height: 96px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--wa-color-border);
  border-radius: 12px;
  resize: none;
  font: inherit;
  color: inherit;
}

.send {
  padding: 8px 12px;
  border: 0;
  border-radius: 12px;
  background: var(--wa-color-accent);
  color: var(--wa-color-accent-text);
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
  background: var(--wa-color-user);
}

.tool-card {
  margin: 0 0 8px;
  padding: 8px 10px;
  border: 1px solid var(--wa-color-border);
  border-radius: 12px;
  background: #f9fafb;
  color: var(--wa-color-muted);
  font-size: 13px;
}

.tool-name {
  color: var(--wa-color-text);
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
  color: var(--wa-color-muted);
}

.timeline-error {
  color: #b91c1c;
}

.confirmation {
  flex: none;
  margin: 0 var(--wa-space) var(--wa-space);
  padding: var(--wa-space);
  border: 1px solid var(--wa-color-border);
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
  border: 1px solid var(--wa-color-border);
  background: var(--wa-color-surface);
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
    max-height: min(var(--wa-panel-max-height), 100dvh);
    border-radius: var(--wa-radius) var(--wa-radius) 0 0;
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
