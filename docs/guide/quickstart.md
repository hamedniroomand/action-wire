# Quickstart

> Register a tool, mount the widget, and ask for the action in words.

This page assumes you finished [Browser setup](/guide/browser-setup) and
[Installation](/guide/installation).

<Steps>

### Register a tool on the page

The application owns the tool. Give it a name, a description, an input schema,
and the handler you already have.

```ts [tools.ts]
await document.modelContext.registerTool({
  name: 'createProject',
  description: 'Create a project.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { name: { type: 'string' } },
    required: ['name'],
  },
  annotations: { readOnlyHint: false, consequentialHint: false },
  execute: async (input) => ({ text: `Created ${projects.create(input.name).name}` }),
});
```

The description is what the model reads to choose the tool. Write it for a
reader who cannot see your code.

`projects` is your own module. The handler calls the same code your buttons
call, so the assistant changes the state the page already shows.

### Mount the widget

```ts [assistant.ts]
import { createAssistant, openAICompatible } from 'actionwire';

const assistant = createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
});

assistant.mount();
```

`createAssistant` builds a native tool source when you leave `source` empty.
Call `mount()` after the page registers its tools.

### Run a model endpoint

The widget posts to `/api/assistant`. That route belongs to your server, and it
holds the API key. See [Model endpoint](/guide/model-endpoint).

### Ask for the action

Start your application, then open it in the flagged browser. Select the
launcher and type `create a project called Phoenix`. The assistant reads the
`createProject` description, shows the tool card, runs your handler, and
answers.

`Phoenix` is only the name you type. The tool creates that project, so nothing
needs to exist first.

</Steps>

::: tip
To see this work before you write an application, run the playground in this
repository. It registers project tools and ships a model endpoint. See
[Development](/project/development).
:::

## Register tools before you mount

Discovery runs at mount. A tool registered later still appears, because the
source listens for `toolchange`, but the first turn is cleaner when the list is
already complete.

Tools that belong to one route must unregister when the route changes. Pass an
`AbortSignal` to `registerTool` and abort it on exit:

```ts [contextual.ts]
let contextual = new AbortController();

function onRouteChange(route: string): void {
  contextual.abort();
  contextual = new AbortController();
  if (route !== 'project-details') return;
  void registerDetailTools(contextual.signal);
}
```

Aborting the signal removes the tool and fires `toolchange`. The assistant
discovers the new list on its own.

## Widget lifecycle

| Call        | Effect                                                         |
| ----------- | -------------------------------------------------------------- |
| `mount()`   | Adds the element to the page. Repeat calls reuse the instance. |
| `unmount()` | Removes the element. The session survives.                     |
| `dispose()` | Removes the element, aborts work, and drops the session.       |

The transcript lives in memory. Minimize and reopen keep it. A page refresh or
`dispose()` clears it. This product does not store past conversations.

## Options

| Option                 | Default | Effect                                                  |
| ---------------------- | ------- | ------------------------------------------------------- |
| `maxRounds`            | `8`     | Model rounds allowed in one user turn.                  |
| `timeoutMs`            | `30000` | Timeout for the model call and for each tool call.      |
| `developerMode`        | `false` | Shows raw JSON on tool cards instead of a text summary. |
| `requiresConfirmation` | none    | Host policy that adds confirmation checks.              |
| `source`               | native  | A custom [tool source](/reference/tool-source).         |

<ReadMore to="/guide/model-endpoint" title="Model endpoint" />
