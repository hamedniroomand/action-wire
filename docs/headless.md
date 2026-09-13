# Headless API

Use `@webmcp-agent/agent` when the host renders its own UI.

```ts
import { createAgentBridge, openAICompatible } from '@webmcp-agent/agent';
import { createWebMCPSource } from '@webmcp-agent/webmcp';

const assistant = createAgentBridge({
  source: createWebMCPSource(),
  model: openAICompatible({ endpoint: '/api/assistant' }),
});

const stop = assistant.subscribe((state) => {
  // Render messages, activities, and confirmation from state.
});

await assistant.send('Open my latest project.');
```

## Methods

| Method                  | Effect                                                                   |
| ----------------------- | ------------------------------------------------------------------------ |
| `send(text)`            | Start one user turn. Rejects with `BUSY` when a turn is already running. |
| `refreshTools()`        | Discover tools again.                                                    |
| `confirm(id, approved)` | Resolve the current confirmation. Ignores a wrong id.                    |
| `cancel()`              | Deny a pending confirmation, or abort the in-flight turn.                |
| `clear()`               | Deny or abort, then drop the in-memory session.                          |
| `getState()`            | Return the current frozen state.                                         |
| `subscribe(listener)`   | Listen for state updates. Returns unsubscribe.                           |
| `dispose()`             | Abort work and release the source subscription.                          |

`createAssistant` from `webmcp-agent` exposes the same methods plus `mount` and `unmount`.

## State

`messages` includes protocol tool messages. `timeline` lists visible user and assistant messages plus tool cards in event order. `activities` hold tool status. `confirmation` is set while the user must approve.

## Cancellation limit

`cancel()` stops further dispatch. It cannot roll back an application action that already completed.

## Widget lifecycle

- `unmount()` removes the element and keeps the session.
- `dispose()` removes the element, aborts work, and drops the session.
- A page refresh also drops the session. The product does not persist previous conversations.
