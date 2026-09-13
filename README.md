# WebMCP Agent

A TypeScript library foundation for an assistant that uses an application's existing WebMCP tools.

The current code provides shared contracts, a tool registry, events, typed errors, and a native browser probe. The agent runtime and widget are not built yet.

## Requirements

- Node.js 22.12+ in the 22 release line, Node.js 24, or Node.js 26+.
- pnpm 12.4.1.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm lint
pnpm format:check
pnpm exec playwright install chromium
pnpm test:e2e
```

Use `pnpm test:watch` for unit tests in watch mode. Use `pnpm test:native` for the required native WebMCP check. Use `pnpm probe` to open the manual probe server.

## Workspace

- `packages/core`: shared types, registry, events, and errors.
- `packages/webmcp`, `packages/agent`, `packages/widget`: reserved for later tasks.
- `playground/compatibility`: native browser probe.
- `examples`: reserved for framework examples.

pnpm runs package build and type checks. No separate task runner is required. Production browser code excludes Node type globals. Test and tooling checks use separate TypeScript configurations.

## Registry contract

`createToolRegistry()` returns `replace(tools)` and `getSnapshot()`. The first snapshot has revision zero. Changed definitions advance the revision. Equal definitions preserve the snapshot, including when schema object keys arrive in a different order. Snapshots contain copied, frozen data.

Tool IDs and names must be unique. Each tool must have a nonempty ID, name, and description. Input schemas must have `type: "object"`. The registry validates draft 2020-12 by default. It also accepts an explicit `http://json-schema.org/draft-07/schema#` dialect. Unknown dialects, invalid schemas, cycles, and non-JSON values fail with `INVALID_SCHEMA`. Invalid replacement leaves the last snapshot intact. Input-instance validation belongs to the later execution adapter.

`createEmitter<T>()` supports `subscribe`, `emit`, and `clear`. Listener errors do not stop delivery. A new listener starts at the next event. Removal takes effect before the next call. Each subscription has its own unsubscribe function.

See [browser compatibility and recorded evidence](docs/compatibility.md).
