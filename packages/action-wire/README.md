<p align="center">
  <img
    src="https://raw.githubusercontent.com/hamedniroomand/action-wire/main/assets/logo.png"
    alt="Action Wire"
    width="160"
  />
</p>

# Action Wire

A text assistant widget that uses the WebMCP tools a page already registered.

Your application publishes its actions once with `document.modelContext.registerTool`. People click them. The assistant calls the same handlers, with the same permissions, and asks before anything destructive. You never write a second copy of a tool schema for the model.

## Requirements

- A browser with native `document.modelContext` in a secure context. Chromium 153 with `--enable-experimental-web-platform-features` is the verified environment. See [compatibility](https://hamedniroomand.github.io/action-wire/project/compatibility).
- An OpenAI-compatible endpoint that you operate. The API key stays on your server.
- ESM. Node.js 22.12+ for tooling.

If your users cannot start a browser with a flag, supply your own tool source instead. See [Without native WebMCP](https://hamedniroomand.github.io/action-wire/guide/without-webmcp).

## Install

```sh
npm install action-wire
```

One package holds the widget, the headless bridge, the WebMCP source, the model adapter, and the types. Its only runtime dependency is `@cfworker/json-schema`, which validates tool input without `eval`, so the widget works under a strict Content-Security-Policy.

## Quick start

Register a tool on the page, then mount the widget.

```ts
import { createAssistant, openAICompatible } from 'action-wire';

const assistant = createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
});
assistant.mount();
```

`/api/assistant` is a route on your own origin that forwards to the model provider and adds the credentials. Do not call a provider from browser code.

## Exports

| Export               | Use                                      |
| -------------------- | ---------------------------------------- |
| `createAssistant`    | Mount the Web Component widget.          |
| `createAgentBridge`  | The same runtime with no user interface. |
| `createWebMCPSource` | Read the tools the page registered.      |
| `openAICompatible`   | Talk to your model endpoint.             |
| `AgentError`         | Every failure, with a stable `code`.     |

Types come from the same entry point, including `ToolSource`, `ToolDefinition`, `AssistantOptions`, `AssistantState`, and `ErrorCode`.

## Safety

Model output is a request, not a command. A tool marked `consequentialHint: true` always asks for approval, and a tool with no `readOnlyHint` asks by default. Approval expires when the tool list changes, so a page cannot swap a harmless tool for a destructive one while the prompt is open.

## Documentation

[Guide](https://hamedniroomand.github.io/action-wire/guide/) ·
[API reference](https://hamedniroomand.github.io/action-wire/reference/) ·
[Architecture](https://hamedniroomand.github.io/action-wire/project/architecture) ·
[GitHub](https://github.com/hamedniroomand/action-wire)

## License

MIT
