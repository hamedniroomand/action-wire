import type { Assistant } from '@webmcp-agent/core';

export const TAG = 'webmcp-assistant';

const sessions = new WeakMap<HTMLElement, { assistant: Assistant; developerMode: boolean }>();

export function defineAssistantElement(): void {
  if (customElements.get(TAG) !== undefined) return;
  class AssistantElement extends HTMLElement {
    #unsubscribe: (() => void) | undefined;

    connectedCallback() {
      if (this.shadowRoot === null) this.attachShadow({ mode: 'open' });
      const session = sessions.get(this);
      this.#unsubscribe?.();
      this.#unsubscribe = session?.assistant.subscribe(() => {});
    }

    disconnectedCallback() {
      this.#unsubscribe?.();
      this.#unsubscribe = undefined;
    }
  }
  customElements.define(TAG, AssistantElement);
}

export function bindAssistant(
  host: HTMLElement,
  assistant: Assistant,
  developerMode: boolean,
): void {
  sessions.set(host, { assistant, developerMode });
}
