# Vanilla JavaScript example

This host uses the built `action-wire` facade. It does not import package source files.

## Prerequisite

The page must run in a secure context with native WebMCP (`document.modelContext`). Chromium 153 with `--enable-experimental-web-platform-features` is the verified environment. Register tools on the page before the assistant discovers them. This example registers one `ping` handler in `src/main.js`.

## Shared development endpoint

The widget calls `POST /api/assistant`. Vite proxies that path to the Node demo server at `http://127.0.0.1:8787`. Copy `playground/.env.example` to `playground/.env`, set the upstream values, then start:

```sh
node playground/server/index.ts
```

Playwright intercepts `/api/assistant` and does not need the Node server.

## Install and run

From the repository root:

```sh
pnpm install
pnpm --filter ./packages/core --filter ./packages/webmcp --filter ./packages/agent --filter ./packages/widget build
pnpm vanilla:dev
```

Open http://127.0.0.1:4176 in flagged Chromium.

## Teardown

Select **Destroy assistant**. This action calls `dispose()`, removes the widget, and aborts the WebMCP registration signal so `ping` is no longer discovered.
