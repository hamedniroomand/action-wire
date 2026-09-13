# Development

> Run the repository, the four demo surfaces, and the test suite.

For commit rules and pull-request expectations, read `CONTRIBUTING.md` in the
repository root.

## Layout

| Path                       | What it is                                                       |
| -------------------------- | ---------------------------------------------------------------- |
| `packages/action-wire`     | The published package. Its `src` holds the four layers below.    |
| `src/core`                 | Types, registry, events, errors. No browser API.                 |
| `src/webmcp`               | Native discovery and execution. The only browser-gated layer.    |
| `src/agent`                | Bridge, session, confirmation policy, OpenAI-compatible adapter. |
| `src/widget`               | The Web Component and its shadow-root interface.                 |
| `playground`               | A project dashboard used by the journey test.                    |
| `playground/compatibility` | The native probe page and its recorded reports.                  |
| `playground/server`        | The development model endpoint.                                  |
| `examples/*`               | One small host application per framework.                        |
| `tests`                    | Cross-cutting Playwright suites and the package smoke test.      |
| `docs`                     | This site.                                                       |

## Commands

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
If the API is absent, it fails.

## Development servers

Build the packages first. The playground and the examples load the built output.

| Command               | Surface                       | Address                 |
| --------------------- | ----------------------------- | ----------------------- |
| `pnpm probe`          | Native compatibility probe    | `http://127.0.0.1:4173` |
| `pnpm widget:dev`     | Widget fixture, no native API | `http://127.0.0.1:4174` |
| `pnpm playground:dev` | Project dashboard             | `http://127.0.0.1:4175` |
| `pnpm vanilla:dev`    | Vanilla example               | `http://127.0.0.1:4176` |
| `pnpm react:dev`      | React example                 | `http://127.0.0.1:4177` |
| `pnpm vue:dev`        | Vue example                   | `http://127.0.0.1:4178` |
| `pnpm svelte:dev`     | Svelte example                | `http://127.0.0.1:4179` |

Open these in a [flagged browser](/guide/browser-setup), except
`pnpm widget:dev`, which uses a fixture tool source and runs anywhere.

## Build order

Core first, then webmcp and agent, then the widget:

```sh
pnpm build
```

## Rules that the tests enforce

- No React, Vue, Svelte, or voice dependency in `packages/action-wire`.
- No tool definition duplicated between the page and the agent.
- No replacement registry and no `document.modelContext` polyfill.
- Layers import in one direction only. `src/core` may not import `src/webmcp`,
  `src/agent`, or `src/widget`; `src/webmcp` and `src/agent` may not import
  `src/widget` or each other. An oxlint rule fails the build otherwise.

## Working on this site

The docs are a separate package with their own install. They are not part of the
root pnpm workspace, so a root `pnpm build` does not build the site.

```sh
cd docs
pnpm install
pnpm dev
```

Pages are Markdown. The directory name sets the section, and the file path sets
the URL, so `guide/quickstart.md` is served at `/guide/quickstart`. The sidebar
order and the site options live in `docs/.vitepress/config.ts`.

Write in the same style as the rest of the site: short sentences, active voice,
one instruction per sentence, no marketing language.
