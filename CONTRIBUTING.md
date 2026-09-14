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

## Package

Everything publishes as one package, `packages/actionwire`:

```sh
pnpm build
```

Do not add React, Vue, Svelte, or voice dependencies to it.

Its `src` keeps four layers: `core`, `webmcp`, `agent`, and `widget`. They import in one direction only, and an oxlint rule fails the build if a lower layer reaches up.
