# Agent rules

Action Wire is a text assistant that discovers WebMCP tools already registered on the page. The application owns schemas and handlers. The assistant does not copy them. The widget is a Web Component. Voice, accounts, RAG, and persisted history are out of scope.

You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written. Trace the real flow, then climb this ladder and stop at the first rung that holds:

1. Do not build it.
2. Reuse what this repository already has.
3. Use the standard library or a native platform feature.
4. Use an installed dependency.
5. Write the shortest correct change.

A bug report names a symptom. Fix the shared function once. Grep every caller.

## Do not

- Polyfill `document.modelContext` or ship a replacement registry.
- Define application tools inside the agent, the widget, or the playground mount.
- Add React, Vue, Svelte, voice, LiveKit, or WebRTC to `packages/actionwire`.
- Import upward between layers. `core` may not import `webmcp`, `agent`, or `widget`; `webmcp` and `agent` may not import `widget` or each other.
- Put model API keys in browser code.
- Import package source from examples. Alias `packages/actionwire/dist`.
- Add a dependency, abstraction, or file that the task does not need.
- Rewrite `docs/` unless the user asks. The user maintains that site.

## Layout

| Path                  | Role                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| `packages/actionwire` | The published package. `src` holds the four layers below.              |
| `src/core`            | Types, registry, events, errors. No browser API.                       |
| `src/webmcp`          | Native discovery and execution. The only browser-gated layer.          |
| `src/agent`           | Bridge, session, confirmation, OpenAI-compatible adapter.              |
| `src/widget`          | Web Component and shadow-root interface.                               |
| `playground`          | Dashboard, probe, and Node model endpoint.                             |
| `examples/*`          | Vanilla, React, Vue, Svelte hosts. Same `setStatus` or `ping` pattern. |
| `tests`               | Cross-cutting Playwright suites and package smoke.                     |

Layer order inside `src`: core, then webmcp and agent, then widget. Imports go one way only. Only `AgentBridge` executes tools. Model output is an untrusted request. The widget presents state. It holds no WebMCP or model logic.

Public name: `action-wire`. Host element `action-wire`. CSS `--aw-*`. Demo env `ACTIONWIRE_*`. Repo: `https://github.com/hamedniroomand/action-wire`.

Example and playground Vite servers: probe `4173`, widget `4174`, playground `4175`, vanilla `4176`, react `4177`, vue `4178`, svelte `4179`. Native checks need Chromium with `--enable-experimental-web-platform-features`. `pnpm test:native` must fail when the API is absent. It does not skip.

## Code

Write technical English in ASD-STE100: short sentences, active voice, one instruction, common words, no idioms, no marketing language. Identifiers keep their real names. Use the same term for the same concept: user, tool, input, output, result, error.

Do not comment obvious code. Comment only an edge case. Mark a deliberate shortcut with `ponytail:` and name the ceiling and the upgrade path. Prefer deletion. Prefer boring. Prefer few files.

## Verify

```sh
pnpm lint:fix
pnpm format
pnpm typecheck
```

Build packages before example or playground runs that load `dist`. Run the tests that cover the change. Example work needs the matching `examples/*/e2e` project.

## Git

Call the system `git` binary by absolute path. Do not use a Cursor wrapper. Do not skip hooks. Conventional subject only (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). No body. No `Co-authored-by` trailers. See `.cursor/rules/git.mdc`.
