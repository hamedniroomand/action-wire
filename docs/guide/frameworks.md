# Frameworks

> The widget is a Web Component. It has no framework dependency, so the same build runs everywhere.

`createAssistant` returns an object with `mount()` and `dispose()`. Every
framework needs the same three things:

1. Create the assistant when the component appears.
2. Register the tools that belong to this component, with an `AbortSignal`.
3. Call `dispose()` and abort the signal when the component goes away.

A tool handler closes over your component state, so the assistant changes the
same state your buttons change.

<Tabs>
<Tab label="React" icon="atom">

```tsx [App.tsx]
useEffect(() => {
  const registration = new AbortController();
  const assistant = createAssistant({
    model: openAICompatible({ endpoint: '/api/assistant' }),
  });
  void document.modelContext.registerTool(tool, { signal: registration.signal }).then(() => {
    if (!registration.signal.aborted) assistant.mount();
  });
  return () => {
    assistant.dispose();
    registration.abort();
  };
}, []);
```

Keep changing values in refs, not in the dependency array. The effect should
run once, or every re-render tears the assistant down and builds it again.

</Tab>

<Tab label="Vue" icon="triangle">

```vue [App.vue]
<script setup lang="ts">
  let registration: AbortController | undefined;
  let assistant: ReturnType<typeof createAssistant> | undefined;

  onMounted(start);
  onUnmounted(stop);

  async function start(): Promise<void> {
    stop();
    registration = new AbortController();
    const signal = registration.signal;
    assistant = createAssistant({
      model: openAICompatible({ endpoint: '/api/assistant' }),
    });
    await document.modelContext.registerTool(tool, { signal });
    if (!signal.aborted) assistant.mount();
  }

  function stop(): void {
    assistant?.dispose();
    registration?.abort();
    assistant = undefined;
    registration = undefined;
  }
</script>
```

A handler can write to a `ref` directly. The view updates the same way it does
after a click.

</Tab>

<Tab label="Svelte" icon="flame">

```svelte [App.svelte]
<script lang="ts">
  let registration: AbortController | undefined;
  let assistant: ReturnType<typeof createAssistant> | undefined;

  onMount(start);
  onDestroy(stop);

  async function start(): Promise<void> {
    stop();
    registration = new AbortController();
    const signal = registration.signal;
    assistant = createAssistant({
      model: openAICompatible({ endpoint: '/api/assistant' }),
    });
    await document.modelContext.registerTool(tool, { signal });
    if (!signal.aborted) assistant.mount();
  }

  function stop(): void {
    assistant?.dispose();
    registration?.abort();
    assistant = undefined;
    registration = undefined;
  }
</script>
```

A handler can assign to a `$state` variable and the view reacts.

</Tab>

<Tab label="Vanilla" icon="code">

```js [main.js]
await document.modelContext.registerTool(tool);

createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
}).mount();
```

With no component lifecycle, register the tools and mount once at startup.

</Tab>
</Tabs>

## Running the examples

Each example is a small host application that registers one tool and mounts the
widget. Build the packages first, because the examples load the built output.

```sh
pnpm build
pnpm vanilla:dev   # http://127.0.0.1:4176
pnpm react:dev     # http://127.0.0.1:4177
pnpm vue:dev
pnpm svelte:dev
```

Open the address in a [flagged browser](/guide/browser-setup). Each example also
has a Playwright test under `examples/<name>/e2e`.

## Where the element goes

`mount(target)` appends the host element to `target`. With no argument it
appends to `document.body`, which keeps the launcher above your layout and out
of any container that clips or transforms its children.

The element is `action-wire`, and it uses a shadow root. Your page styles
do not leak into the panel, and the panel does not leak out. Style it through
CSS variables. See [Styling](/guide/styling).
