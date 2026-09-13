# Headless bridge

> `createAgentBridge` from `action-wire`. The whole product, without a user interface.

Use this when your application renders its own chat surface.

```ts [assistant.ts]
import { createAgentBridge, createWebMCPSource, openAICompatible } from 'action-wire';

const assistant = createAgentBridge({
  source: createWebMCPSource(),
  model: openAICompatible({ endpoint: '/api/assistant' }),
});

const stop = assistant.subscribe((state) => {
  render(state);
});

await assistant.send('Open my latest project.');
```

## Options

`BridgeOptions` takes the same fields as the widget, without `developerMode`,
and `source` is required.

## Methods

| Method                  | Effect                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `send(text)`            | Runs one user turn. Rejects with `BUSY` when a turn is already running. |
| `refreshTools()`        | Discovers tools again and returns the new snapshot.                     |
| `confirm(id, approved)` | Resolves the open confirmation. A wrong id is ignored.                  |
| `cancel()`              | Denies a pending confirmation, or aborts the running turn.              |
| `clear()`               | Denies or aborts, then drops the session.                               |
| `getState()`            | Returns the current frozen state.                                       |
| `subscribe(listener)`   | Listens for state changes. Returns an unsubscribe function.             |
| `dispose()`             | Aborts work and releases the source subscription.                       |

## State

`subscribe` and `getState` give you an `AssistantState`:

| Field          | Type                        | Meaning                                                  |
| -------------- | --------------------------- | -------------------------------------------------------- |
| `timeline`     | `TimelineItem[]`            | What to draw, in order: visible messages and tool cards. |
| `messages`     | `Message[]`                 | The full transcript, including protocol tool messages.   |
| `activities`   | `Activity[]`                | One entry per tool call, with its status and result.     |
| `confirmation` | `Confirmation \| undefined` | Set while a person must approve a call.                  |
| `busy`         | `boolean`                   | A turn is running.                                       |
| `error`        | `{ code, message }`         | The last turn failure.                                   |

Draw from `timeline`, not from `messages`. `messages` contains protocol entries a
person should not read.

### Tool status

An `Activity` moves through `queued`, then `awaiting-confirmation` when it needs
approval, then `running`, and finishes at `success`, `error`, or `cancelled`.

## Turn rules

One turn runs at a time. Inside a turn, tool calls run in order, never in
parallel. A turn ends when the model returns text with no tool calls, or when it
hits `maxRounds`, `timeoutMs`, or an abort.

## Cancellation limit

`cancel()` stops the assistant from dispatching more calls. It cannot roll back
an application action that already finished.

## Session lifetime

The session is in memory. It survives `unmount()`. It does not survive
`dispose()`, `clear()`, or a page refresh. This product stores no conversation
history.
