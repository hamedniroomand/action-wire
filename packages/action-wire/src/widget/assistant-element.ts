import type { Assistant, AssistantState } from '~/core';
import { attachShell } from '~/widget/shell';

export const TAG = 'action-wire';

const sessions = new WeakMap<HTMLElement, { assistant: Assistant; developerMode: boolean }>();

export function defineAssistantElement(): void {
  if (customElements.get(TAG) !== undefined) return;
  class AssistantElement extends HTMLElement {
    #unsubscribe: (() => void) | undefined;
    #sync: ((state: AssistantState) => void) | undefined;

    connectedCallback() {
      const session = sessions.get(this);
      if (session === undefined) return;
      const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      this.#sync ??= attachShell(shadow, session.assistant, session.developerMode);
      this.#unsubscribe?.();
      this.#unsubscribe = session.assistant.subscribe((state) => {
        this.#sync?.(state);
      });
      this.#sync(session.assistant.getState());
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
