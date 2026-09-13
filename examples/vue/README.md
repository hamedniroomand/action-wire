# Vue example

This host registers a native WebMCP tool and mounts `createAssistant` with `onMounted`. `onUnmounted` disposes the assistant and aborts the registration signal. The handler reads current reactive state. Imports use the same built package output as the Vanilla and React examples.

## Prerequisite

Native WebMCP (`document.modelContext`) must be present. Use Chromium with `--enable-experimental-web-platform-features`.

## Shared development endpoint

The widget posts to `/api/assistant`. Vite proxies that path to `http://127.0.0.1:8787`. Copy `playground/.env.example` to `playground/.env` and start:

```sh
node playground/server/index.ts
```

## Install and run

```sh
pnpm install
pnpm build
pnpm vue:dev
```

Open http://127.0.0.1:4178 in flagged Chromium.

## Teardown

Select **Unmount**. Cleanup disposes the assistant and removes the `setStatus` registration.
