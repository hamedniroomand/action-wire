import { createAgentBridge } from '~/agent';
import type { Assistant, AssistantOptions, MountedAssistant, Theme, ToolSource } from '~/core';
import { createWebMCPSource } from '~/webmcp';
import { bindAssistant, defineAssistantElement, TAG } from '~/widget/element';

export function createAssistant(options: AssistantOptions): MountedAssistant {
  let bridge: Assistant | undefined;
  let host: HTMLElement | undefined;
  let ownedSource: ToolSource | undefined;
  let theme: Theme = options.theme ?? 'system';

  function ensureBridge(): Assistant {
    if (bridge !== undefined) return bridge;
    const source = options.source ?? (ownedSource ??= createWebMCPSource());
    const next = createAgentBridge({
      source,
      model: options.model,
      ...(options.requiresConfirmation === undefined
        ? {}
        : { requiresConfirmation: options.requiresConfirmation }),
      ...(options.maxRounds === undefined ? {} : { maxRounds: options.maxRounds }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.reviewTimeoutMs === undefined
        ? {}
        : { reviewTimeoutMs: options.reviewTimeoutMs }),
      ...(options.context === undefined ? {} : { context: options.context }),
      ...(options.review === undefined ? {} : { review: options.review }),
    });
    bridge = next;
    return next;
  }

  return {
    send: (text) => ensureBridge().send(text),
    refreshTools: () => ensureBridge().refreshTools(),
    confirm: (id, version, approved) => {
      ensureBridge().confirm(id, version, approved);
    },
    edit: (id, version, args) => {
      ensureBridge().edit(id, version, args);
    },
    removeContext: (id) => {
      ensureBridge().removeContext(id);
    },
    cancel: () => {
      bridge?.cancel();
    },
    clear: () => {
      ensureBridge().clear();
    },
    getState: () => ensureBridge().getState(),
    subscribe: (listener) => ensureBridge().subscribe(listener),
    dispose() {
      host?.remove();
      host = undefined;
      bridge?.dispose();
      bridge = undefined;
      ownedSource?.dispose();
      ownedSource = undefined;
    },
    mount(target) {
      const document = currentDocument();
      defineAssistantElement();
      const assistant = ensureBridge();
      if (host === undefined) {
        host = document.createElement(TAG);
        host.dataset['theme'] = theme;
        bindAssistant(host, assistant, options.developerMode === true);
      }
      const parent = target ?? document.body;
      if (host.parentNode !== parent) parent.append(host);
    },
    unmount() {
      host?.remove();
    },
    setTheme(next) {
      theme = next;
      if (host !== undefined) host.dataset['theme'] = next;
    },
  };
}

function currentDocument(): Document {
  const value = Reflect.get(globalThis, 'document');
  if (!isDocument(value)) throw new Error('document is not available.');
  return value;
}

function isDocument(value: unknown): value is Document {
  return typeof value === 'object' && value !== null && 'createElement' in value && 'body' in value;
}
