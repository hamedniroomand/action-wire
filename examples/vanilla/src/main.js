import { createAssistant, openAICompatible } from 'action-wire';

const registration = new AbortController();
const assistant = createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
});

function nativeContext() {
  const value = Reflect.get(document, 'modelContext');
  if (typeof value !== 'object' || value === null) return undefined;
  if (typeof Reflect.get(value, 'registerTool') !== 'function') return undefined;
  return value;
}

async function registerPing(context) {
  await context.registerTool(
    {
      name: 'ping',
      description: 'Return pong from the existing host handler.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: { readOnlyHint: true, consequentialHint: false },
      execute: async () => {
        Reflect.set(globalThis, '__pinged', true);
        return { text: 'pong' };
      },
    },
    { signal: registration.signal },
  );
}

const destroy = document.querySelector('#destroy');
if (!(destroy instanceof HTMLButtonElement)) throw new Error('The destroy control is missing.');

destroy.addEventListener('click', () => {
  assistant.dispose();
  registration.abort();
});

const context = nativeContext();
const status = document.querySelector('p');
if (context === undefined) {
  if (status instanceof HTMLParagraphElement) {
    status.textContent =
      'This browser does not expose document.modelContext. Use Chromium with --enable-experimental-web-platform-features.';
  }
} else {
  void registerPing(context).then(() => {
    assistant.mount();
    return undefined;
  });
}
