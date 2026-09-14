# Development

> Run the repository, the four demo surfaces, and the test suite.

For commit rules and pull-request expectations, read `CONTRIBUTING.md` in the
repository root.

## Layout

| Path                       | What it is                                                       |
| -------------------------- | ---------------------------------------------------------------- |
| `packages/actionwire`      | The published package. Its `src` holds the four layers below.    |
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

Only the examples load the built output. Run `pnpm build` before you start one.
The probe, the widget fixture, and the playground load the source. They need no
build.

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

## Talk to the assistant in the playground

The playground calls a model. Put your provider key in `playground/.env` first.
See [Model endpoint](/guide/model-endpoint). Then start one command.

```sh
pnpm playground:dev
```

It serves the dashboard on `127.0.0.1:4175` and starts the model endpoint on
`127.0.0.1:8787` in the same process. It proxies `/api/assistant` to that port.
Open `http://127.0.0.1:4175` in the flagged browser, then ask the assistant to
open or delete a project.

To run the model endpoint alone, use `pnpm playground:server`. The playground
finds a running endpoint on the port and does not start a second one.

`pnpm widget:dev` needs no model endpoint. It uses a scripted model.

## Build order

Core first, then webmcp and agent, then the widget:

```sh
pnpm build
```

## Rules that the tests enforce

- No React, Vue, Svelte, or voice dependency in `packages/actionwire`.
- No tool definition duplicated between the page and the agent.
- No replacement registry and no `document.modelContext` polyfill.
- Layers import in one direction only. `src/core` may not import `src/webmcp`,
  `src/agent`, or `src/widget`; `src/webmcp` and `src/agent` may not import
  `src/widget` or each other. An oxlint rule fails the build otherwise.

## Working on this site

The site is a VitePress package in `docs`. It is part of the pnpm workspace, so
a root `pnpm install` installs it. A root `pnpm build` builds the library only.

```sh
pnpm --filter actionwire-docs dev
pnpm docs:build
```

Pages are Markdown. The directory name sets the section, and the file path sets
the URL, so `guide/quickstart.md` is served at `/guide/quickstart`. The sidebar
order and the site options live in `docs/.vitepress/config.ts`.

Write in the same style as the rest of the site: short sentences, active voice,
one instruction per sentence, no marketing language.
