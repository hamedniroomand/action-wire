import type { Assistant, AssistantState, ToolSnapshot } from '~/core';
import { createBar } from '~/widget/bar';
import { createContextRow } from '~/widget/context';
import { hotkeyLabel, isMacPlatform, listenToggle } from '~/widget/hotkey';
import { activeReviewProposal, toBarMode } from '~/widget/modes';
import { createProposalPanel } from '~/widget/proposal';
import { STYLES } from '~/widget/styles';
import { createTranscript } from '~/widget/transcript';

export const TAG = 'action-wire';

const sessions = new WeakMap<HTMLElement, { assistant: Assistant; developerMode: boolean }>();

export function defineAssistantElement(): void {
  if (customElements.get(TAG) !== undefined) return;
  class AssistantElement extends HTMLElement {
    #teardown: (() => void) | undefined;

    connectedCallback() {
      const session = sessions.get(this);
      if (session === undefined) return;
      this.#teardown?.();
      const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      this.#teardown = attach(shadow, session.assistant, session.developerMode);
    }

    disconnectedCallback() {
      this.#teardown?.();
      this.#teardown = undefined;
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

function attach(shadow: ShadowRoot, assistant: Assistant, developerMode: boolean): () => void {
  const mac = isMacPlatform();
  const ui = { open: false, transcriptOpen: false, tools: undefined as number | undefined };
  let fetchedTools = false;

  const style = document.createElement('style');
  style.textContent = STYLES;
  const root = document.createElement('div');
  root.className = 'root';
  const transcriptRoot = document.createElement('div');
  const contextRoot = document.createElement('div');
  const proposalRoot = document.createElement('div');
  const barRoot = document.createDocumentFragment();
  let toolSnapshot: ToolSnapshot | undefined;

  const contextRow = createContextRow(contextRoot, {
    remove: (id) => {
      assistant.removeContext(id);
    },
    focusComposer: () => {
      bar.focus();
    },
  });

  const proposalPanel = createProposalPanel(proposalRoot, {
    confirm: (id, version, approved) => {
      assistant.confirm(id, version, approved);
    },
    edit: (id, version, args) => {
      assistant.edit(id, version, args);
    },
  });

  function render(state: AssistantState = assistant.getState()): void {
    contextRow.sync(state.context);
    const review = activeReviewProposal(state);
    const tool =
      review === undefined || toolSnapshot === undefined
        ? undefined
        : toolSnapshot.tools.find((entry) => entry.id === review.call.toolId);
    const reviewInPanel = proposalPanel.sync(review, tool);
    const mode = toBarMode(state, { open: ui.open, draft: bar.getDraft(), reviewInPanel });
    transcript.sync(state, ui.open && ui.transcriptOpen);
    bar.sync(mode, ui.tools, ui.transcriptOpen);
  }

  function setOpen(open: boolean): void {
    if (ui.open === open) return;
    ui.open = open;
    if (!open) ui.transcriptOpen = false;
    render();
    bar.focus();
    if (open && !fetchedTools) {
      fetchedTools = true;
      void (async () => {
        try {
          toolSnapshot = await assistant.refreshTools();
          ui.tools = toolSnapshot.tools.length;
          render();
        } catch {
          // No pill when discovery fails. The turn reports the error itself.
        }
      })();
    }
  }

  const transcript = createTranscript(
    transcriptRoot,
    {
      close: () => {
        ui.transcriptOpen = false;
        render();
        bar.focus();
      },
      clear: () => {
        assistant.clear();
      },
    },
    { developerMode },
  );

  const bar = createBar(
    barRoot,
    {
      open: () => {
        setOpen(true);
      },
      close: () => {
        setOpen(false);
      },
      send: (text) => {
        if (assistant.getState().busy) return;
        void assistant.send(text).catch(() => {});
        render();
      },
      stop: () => {
        assistant.cancel();
      },
      retry: (text) => {
        void assistant.send(text).catch(() => {});
      },
      confirm: (id, version, approved) => {
        assistant.confirm(id, version, approved);
      },
      transcript: () => {
        ui.transcriptOpen = !ui.transcriptOpen;
        render();
      },
      draft: () => {
        render();
      },
    },
    { hotkeyLabel: hotkeyLabel(mac) },
  );

  root.append(transcriptRoot, contextRoot, proposalRoot, barRoot);
  shadow.replaceChildren(style, root);

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    const review = activeReviewProposal(assistant.getState());
    if (review?.status === 'ready-for-review') {
      assistant.confirm(review.id, review.version, false);
      return;
    }
    if (ui.transcriptOpen) {
      ui.transcriptOpen = false;
      render();
      bar.focus();
      return;
    }
    setOpen(false);
  }
  root.addEventListener('keydown', onKeydown);

  const unsubscribe = assistant.subscribe((state) => {
    render(state);
  });
  const stopHotkey = listenToggle(
    document,
    () => {
      setOpen(!ui.open);
    },
    mac,
  );
  render();

  return () => {
    unsubscribe();
    stopHotkey();
    root.removeEventListener('keydown', onKeydown);
  };
}
