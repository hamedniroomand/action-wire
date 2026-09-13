# Quickstart

## Prerequisite

The page must run in a secure context. The browser must expose `document.modelContext`. Chromium 153 with `--enable-experimental-web-platform-features` is the verified environment. Firefox and Safari are not in the release matrix. The library does not ship a replacement registry.

Register application tools with native WebMCP. The assistant reads those tools. It does not copy their schemas.

## Install

```sh
npm install webmcp-agent @webmcp-agent/agent
```

These packages are ESM. Import them from a bundler or a native module page.

## Mount the widget

```ts
import { openAICompatible } from '@webmcp-agent/agent';
import { createAssistant } from 'webmcp-agent';

const assistant = createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
});
assistant.mount();
```

`createAssistant` uses `createWebMCPSource()` when you omit `source`. Call `mount()` after the page registers tools. `unmount()` removes the element and keeps the session. `dispose()` removes the element, aborts work, and drops the session.

## Node endpoint

The browser adapter posts to `/api/assistant`. Keep provider credentials on the server. The demo server is `playground/server/index.ts`. It forwards schemas and messages. It does not execute browser tools.

Copy `playground/.env.example` to `playground/.env` and set:

- `WEBMCP_AGENT_UPSTREAM_URL`
- `WEBMCP_AGENT_MODEL`
- `WEBMCP_AGENT_API_KEY`

Start the server:

```sh
node playground/server/index.ts
```

The default listen address is `127.0.0.1:8787`. Production hosts must add authentication and rate limits.

## Session

The widget keeps the current session in memory. Minimize and reopen keep the same instance. Refresh or `dispose()` clears the transcript. The product does not persist previous conversations.

## CSS

The host is `webmcp-assistant`. Override CSS variables on that element:

```css
webmcp-assistant {
  --wa-color-accent: #2563eb;
  --wa-panel-width: 380px;
  --wa-panel-max-height: 640px;
}
```

See the variable list in `packages/widget/src/styles.ts`.

## Developer mode

Pass `developerMode: true` to show raw JSON on tool cards. The default view shows text summaries only.

## Options

- `maxRounds`: default 8 model rounds per user turn.
- `timeoutMs`: default 30000 for the model and tool turn.
- `requiresConfirmation`: host policy that can require extra confirmation.

## Framework examples

- Vanilla JavaScript: `examples/vanilla`
- React: `examples/react`
- Vue: `examples/vue`

Build the packages first, then run `pnpm vanilla:dev`, `pnpm react:dev`, or `pnpm vue:dev`.
