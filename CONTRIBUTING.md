# Contributing

## Commands

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm lint
pnpm format:check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:native
```

`pnpm test:native` must pass on a real native WebMCP browser. It does not skip.

Use `pnpm playground:dev` for the dashboard. Use `pnpm widget:dev` for the fixture widget. Use `pnpm probe` for the native probe page.

## Commits

Use a conventional type and subject only (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Do not add a body. Do not add `Co-authored-by` trailers. Call the system `git` binary. Do not skip hooks.

## Packages

Build order is core, then webmcp and agent, then widget:

```sh
pnpm --filter ./packages/core --filter ./packages/webmcp --filter ./packages/agent --filter ./packages/widget build
```

Do not add React, Vue, or voice dependencies to `packages/core`, `packages/webmcp`, `packages/agent`, or `packages/widget`.
