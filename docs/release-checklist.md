# Release checklist

Candidate version: **0.1.0**. License: **MIT**. npm publication is a separate explicit action. Do not publish until the npm org and unscoped name are owned.

Recorded: 2026-09-13. Host: macOS. Playwright 1.63.0. Bundled Chromium 153.0.8010.12.

## PRD acceptance

| #   | Criterion                                                                          | Evidence                                                                                        |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | A web application can expose WebMCP tools                                          | `playground/src/tools.ts`                                                                       |
| 2   | The library discovers them automatically                                           | `tests/e2e/native-webmcp.spec.ts`, `playground/compatibility/probe.spec.ts`                     |
| 3   | The tools become available to the text agent                                       | `playground/e2e/journey.spec.ts`, `tests/e2e/native-webmcp.spec.ts`                             |
| 4   | The user can request an action using natural language                              | `playground/e2e/journey.spec.ts`                                                                |
| 5   | The agent selects and calls the correct WebMCP tool                                | `playground/e2e/journey.spec.ts`                                                                |
| 6   | The existing application handler performs the action                               | playground journey; Vanilla, React, Vue, and Svelte example tests                               |
| 7   | The result is returned to the agent                                                | `playground/e2e/journey.spec.ts`                                                                |
| 8   | The assistant responds naturally after execution                                   | Scripted wording in `playground/e2e/journey.spec.ts`. Manual real-model steps are in that file. |
| 9   | Tool activity is visible in the widget                                             | Journey; `packages/widget/e2e/accessibility.spec.ts`                                            |
| 10  | Destructive actions require confirmation                                           | Journey; widget confirmation tests                                                              |
| 11  | Tool availability can refresh while the app is running                             | Journey billing tools; `tests/e2e/failures.spec.ts` navigation case                             |
| 12  | The same browser/core implementation works with Vanilla JS, Vue, React, and Svelte | `tests/e2e/frameworks.spec.ts`; `examples/*/e2e`                                                |
| 13  | No tool definition is duplicated between WebMCP and the agent                      | `tests/e2e/frameworks.spec.ts` checks `playground/src/assistant.ts`                             |
| 14  | No voice-related dependencies are introduced in Phase 1                            | `tests/e2e/frameworks.spec.ts`; `tests/package-smoke.test.ts`                                   |

See [compatibility](compatibility.md) for the native matrix. Fixture `ToolSource` tests are not native evidence.

## Exclusions that must not ship

- No `document.modelContext` polyfill or replacement registry.
- No voice, LiveKit, STT, TTS, or WebRTC.
- No persisted conversation history, accounts, or RAG.
- Firefox, Safari, and unflagged Chromium are unsupported hosts.

## Native browser and real-model journey

- Native probe and widget path: Playwright Chromium 153.0.8010.12 with `--enable-experimental-web-platform-features` on `http://127.0.0.1`. `pnpm test:native` fails if the API is absent.
- Real-model journey: copy `playground/.env.example` to `playground/.env`, start `pnpm playground:dev` and `node playground/server/index.ts`, open `http://127.0.0.1:4175` in flagged Chromium, then open the latest project, rename it, and delete it. Do not assert model wording.

## Package names and version

Checked on npmjs 2026-09-13. These names returned 404 (not published):

- `webmcp-agent`
- `@webmcp-agent/core`
- `@webmcp-agent/webmcp`
- `@webmcp-agent/agent`

The scope `@webmcp-agent` is not an npm org until someone creates it. Create the org, then publish. The workspace root is also named `webmcp-agent` and is `"private": true`. Publish from `packages/*` only. Public version is **0.1.0**.

## Tarball inspection

Packed on 2026-09-13 with `pnpm pack`. Contents were `package.json`, `LICENSE`, and `dist/**` only. No `.env`, secrets, credentials, or test fixtures. Compressed sizes:

| Tarball                         | Bytes |
| ------------------------------- | ----- |
| `webmcp-agent-core-0.1.0.tgz`   | 7325  |
| `webmcp-agent-webmcp-0.1.0.tgz` | 8857  |
| `webmcp-agent-agent-0.1.0.tgz`  | 10611 |
| `webmcp-agent-0.1.0.tgz`        | 13241 |

`tests/package-smoke.test.ts` installs these tarballs in a clean consumer and imports them from Node and TypeScript.

## Commands and results

Run from the repository root after `pnpm install --frozen-lockfile`:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm test:native
```

Record the date, Node version, and pass/fail next to each command on the release day.

## Publish instructions

Do not run these until name ownership is confirmed.

1. `npm login`
2. Create the `@webmcp-agent` org on npm if it does not exist.
3. Build: `pnpm --filter ./packages/core --filter ./packages/webmcp --filter ./packages/agent --filter ./packages/widget build`
4. Publish in order, from each package directory: `@webmcp-agent/core`, `@webmcp-agent/webmcp`, `@webmcp-agent/agent`, `webmcp-agent`.
5. Tag the git commit `v0.1.0` after a successful publish.
