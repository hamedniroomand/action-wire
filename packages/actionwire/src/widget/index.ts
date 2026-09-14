import { createAgentBridge } from '~/agent';
import type { Assistant, AssistantOptions, MountedAssistant, ToolSource } from '~/core';
import { createWebMCPSource } from '~/webmcp';
import { bindAssistant, defineAssistantElement, TAG } from '~/widget/assistant-element';

export function createAssistant(options: AssistantOptions): MountedAssistant {
  let bridge: Assistant | undefined;
  let host: HTMLElement | undefined;
  let ownedSource: ToolSource | undefined;

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
    });
    bridge = next;
    return next;
  }

  return {
    send: (text) => ensureBridge().send(text),
    refreshTools: () => ensureBridge().refreshTools(),
    confirm: (id, approved) => {
      ensureBridge().confirm(id, approved);
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
        bindAssistant(host, assistant, options.developerMode === true);
      }
      const parent = target ?? document.body;
      if (host.parentNode !== parent) parent.append(host);
    },
    unmount() {
      host?.remove();
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
