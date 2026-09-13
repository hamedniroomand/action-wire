# React example

This host mounts `createAssistant` in a React effect. It imports the built packages, not package source files.

React StrictMode runs mount, cleanup, and remount. The effect aborts the WebMCP registration signal and calls `dispose()` on cleanup so one assistant and one `setStatus` tool remain.

The tool handler reads current host state through a ref. It does not close over a stale render.

## Prerequisite

Native WebMCP (`document.modelContext`) must be present. Use Chromium with `--enable-experimental-web-platform-features`. Register tools in the same effect that mounts the assistant.

## Shared development endpoint

The widget posts to `/api/assistant`. Vite proxies that path to `http://127.0.0.1:8787`. Copy `playground/.env.example` to `playground/.env` and start:

```sh
node playground/server/index.ts
```

## Install and run

```sh
pnpm install
pnpm build
pnpm react:dev
```

Open http://127.0.0.1:4177 in flagged Chromium.

## Teardown

Select **Unmount**. Cleanup disposes the assistant and aborts the tool registration.
