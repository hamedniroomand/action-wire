<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createAssistant, openAICompatible } from 'actionwire';

  let live = $state(true);
  let label = $state('idle');

  let registration: AbortController | undefined;
  let assistant: ReturnType<typeof createAssistant> | undefined;

  async function start(): Promise<void> {
    stop();
    registration = new AbortController();
    assistant = createAssistant({
      model: openAICompatible({ endpoint: '/api/assistant' }),
    });
    const context = nativeContext();
    const signal = registration.signal;
    if (context === undefined) return;
    try {
      await context.registerTool(
        {
          name: 'setStatus',
          description: 'Set the visible host status from current Svelte state.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
          annotations: { readOnlyHint: false, consequentialHint: false },
          execute: async (input: unknown) => {
            const next = readName(input) ?? `${label}-done`;
            label = next;
            return { text: next };
          },
        },
        { signal },
      );
      if (!signal.aborted) assistant.mount();
    } catch (error) {
      if (isAbort(error) || signal.aborted) return;
      throw error;
    }
  }

  function stop(): void {
    assistant?.dispose();
    registration?.abort();
    assistant = undefined;
    registration = undefined;
  }

  function setLive(next: boolean): void {
    live = next;
    if (next) {
      void start();
      return;
    }
    stop();
  }

  onMount(() => {
    void start();
  });
  onDestroy(() => {
    stop();
  });

  type NativeContext = {
    registerTool(tool: object, options?: { signal: AbortSignal }): Promise<void>;
  };

  function nativeContext(): NativeContext | undefined {
    const value = Reflect.get(document, 'modelContext');
    if (!isNativeContext(value)) return undefined;
    return value;
  }

  function isNativeContext(value: unknown): value is NativeContext {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof Reflect.get(value, 'registerTool') === 'function'
    );
  }

  function isAbort(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError'
    );
  }

  function readName(input: unknown): string | undefined {
    const name = asRecord(input)['name'];
    return typeof name === 'string' ? name : undefined;
  }

  function asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'string') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        return {};
      }
      return asRecord(parsed);
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value));
    }
    return {};
  }
</script>

<main>
  <h1>Svelte host</h1>
  <p>Status: {label}</p>
  {#if live}
    <button
      type="button"
      onclick={() => setLive(false)}
    >
      Unmount
    </button>
  {:else}
    <button
      type="button"
      onclick={() => setLive(true)}
    >
      Mount
    </button>
  {/if}
</main>
