# ToolSource

> Where tools come from. Use the native one, or write your own.

```ts
interface ToolSource {
  discover(signal?: AbortSignal): Promise<ToolSnapshot>;
  execute(call: ToolCall, revision: number, signal?: AbortSignal): Promise<ToolResult>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
```

## The native source

```ts
import { createWebMCPSource } from 'action-wire';

const source = createWebMCPSource();
```

It reads `document.modelContext`, and it:

- Discovers with `getTools()` and keeps the native handle for each tool.
- Skips any tool whose `window` is not the current window. Frames are out of
  scope for this release.
- Parses the input schema once and reuses it. It does not write a second schema.
- Listens for `toolchange` and re-discovers.
- Validates arguments against the tool schema before it calls the handler.
- Reads `readOnlyHint` and `consequentialHint` into the tool definition.

Construction does not throw on a browser with no WebMCP. The first `discover()`
throws `UNSUPPORTED_WEBMCP` instead.

::: note
The native source sends arguments in the format each discovered tool declares:
a JSON string for the older Chromium build, an object for the newer one. Both
work with no configuration.
:::

## ToolDefinition

| Field           | Type                   | Meaning                                          |
| --------------- | ---------------------- | ------------------------------------------------ |
| `id`            | `string`               | Unique key used by the bridge to run the tool.   |
| `name`          | `string`               | Name the model sees.                             |
| `description`   | `string`               | What the model reads to choose the tool.         |
| `inputSchema`   | `Record<string, Json>` | JSON Schema object. Must be `type: "object"`.    |
| `readOnly`      | `boolean \| undefined` | From `readOnlyHint`. Missing means unsafe.       |
| `consequential` | `boolean \| undefined` | From `consequentialHint`. `true` always prompts. |

Ids and names must be unique and non-empty. Supported schema dialects are JSON
Schema 2020-12, the default, and draft-07.

## Revisions

`ToolSnapshot` carries a `revision`. It rises when the tool list changes in a way
that matters, including a re-registration that keeps the same name and schema.

The bridge passes the revision it planned against into `execute`. If the source
has moved on, the call fails with `STALE_TOOLS` and the handler does not run.
This is what makes an approval expire. See
[Confirmations](/guide/confirmations).

If you write a source, raise `revision` and call your subscribers whenever your
tool list changes. Skipping that lets an old approval run against a new tool.

## Writing a source

Follow the worked example under
[Without native WebMCP](/guide/without-webmcp). The short contract:

- `discover` returns the current snapshot. Throw `AgentError` on failure.
- `execute` returns a `ToolResult` with `ok: false` and a `code` on failure. Do
  not throw for an ordinary tool error.
- `subscribe` returns its own unsubscribe function.
- `dispose` releases everything and makes later calls fail.
