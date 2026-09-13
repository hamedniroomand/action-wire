# WebMCP compatibility

## Verified environment

Test date: 2026-09-13. Host: macOS. Runner: Playwright 1.63.0. Browser: bundled headless Chromium 153.0.8010.12. The page ran at `http://127.0.0.1:4173`. The browser reported a secure context for this loopback origin.

| Browser configuration                                       | Result                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| Default Playwright Chromium                                 | Required API absent. The probe showed an unsupported message.          |
| Chromium with `--enable-experimental-web-platform-features` | Native registration, discovery, execution, events, and removal passed. |

See the [default report](compatibility/2026-09-13-chromium.json) and [enabled report](compatibility/2026-09-13-chromium-webmcp.json). These files are fixed evidence from this run. New runs write reports under `test-results/`.

## Observed native API

- `document.modelContext` has `registerTool`, `getTools`, and `executeTool` methods.
- The probe registered its echo tool before discovery. It did not patch registration or use a replacement registry.
- Discovery returned the tool with its name, description, origin, current window, annotations, and a JSON-string input schema.
- Execution required JSON-string arguments in this browser build. Object arguments failed before the handler ran. The probe selects the input format from the discovered schema format. It does not retry execution.
- The original handler ran once. Execution returned `{"text":"WebMCP probe"}` as a JSON string.
- `toolchange` fired after registration and removal. Aborting the registration signal removed the tool.
- The returned annotations included `readOnlyHint: true` and `untrustedContentHint: false`. They did not include `consequentialHint`.

The [current WebMCP draft](https://webmachinelearning.github.io/webmcp/) describes object input schemas and object arguments. [Chrome documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api) notes an argument-format change from Chrome 155. The verified Chromium 153 target uses the older format. No claim is made that it implements the full current draft.

[Chrome setup guidance](https://developer.chrome.com/docs/ai/webmcp) lists a local testing flag, origin isolation, and a `tools` permissions policy. This probe used the command-line flag listed above. It did not test an origin-trial token, cross-origin frames, insecure remote HTTP, or other browser engines.

## Unsupported browsers

These configurations are not a supported WebMCP host for this release. The product does not ship a replacement `document.modelContext` or another workaround.

| Browser configuration                                                     | Result                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Playwright Chromium without `--enable-experimental-web-platform-features` | Required API absent. The widget shows an unsupported message.      |
| Firefox                                                                   | Not verified. The required API is not part of this release matrix. |
| Safari / WebKit                                                           | Not verified. The required API is not part of this release matrix. |
| Insecure remote HTTP                                                      | Out of scope. Discovery requires a secure context.                 |

Fixture Playwright suites under `tests/e2e/failures.spec.ts` and `packages/widget/e2e` use a test `ToolSource`. They are not native compatibility evidence. Native evidence is `pnpm test:native`, `playground/compatibility/probe.spec.ts`, and `tests/e2e/native-webmcp.spec.ts`. That native suite fails when the API is absent. It does not skip.

## Widget viewport matrix

Verified in Playwright Chromium with `tests/e2e/frameworks.spec.ts`.

| Viewport                         | Result                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| 1280×800                         | Panel width stays in 360–400px and inside the viewport.                              |
| 640×568                          | Bottom sheet. Composer stays visible.                                                |
| 320×568                          | Bottom sheet. Composer stays visible. Horizontal overflow stays at most 1px.         |
| `prefers-reduced-motion: reduce` | Transitions are disabled.                                                            |
| Keyboard                         | Enter opens the panel. Enter sends. Escape closes and returns focus to the launcher. |

## PRD acceptance evidence

| #   | Criterion                                                                  | Evidence                                                                                        |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | A web application can expose WebMCP tools                                  | `playground/src/tools.ts`, native probe reports                                                 |
| 2   | The library discovers them automatically                                   | `tests/e2e/native-webmcp.spec.ts`, `playground/compatibility/probe.spec.ts`                     |
| 3   | The tools become available to the text agent                               | `playground/e2e/journey.spec.ts`, `tests/e2e/native-webmcp.spec.ts`                             |
| 4   | The user can request an action using natural language                      | `playground/e2e/journey.spec.ts`                                                                |
| 5   | The agent selects and calls the correct WebMCP tool                        | `playground/e2e/journey.spec.ts`                                                                |
| 6   | The existing application handler performs the action                       | playground journey plus Vanilla/React/Vue example tests                                         |
| 7   | The result is returned to the agent                                        | `playground/e2e/journey.spec.ts`                                                                |
| 8   | The assistant responds naturally after execution                           | Scripted wording in `playground/e2e/journey.spec.ts`. Manual real-model steps are in that file. |
| 9   | Tool activity is visible in the widget                                     | Journey plus `packages/widget/e2e/accessibility.spec.ts`                                        |
| 10  | Destructive actions require confirmation                                   | Journey plus widget confirmation tests                                                          |
| 11  | Tool availability can refresh while the app is running                     | Journey billing tools, `tests/e2e/failures.spec.ts` navigation case                             |
| 12  | The same browser/core implementation works with Vanilla JS, Vue, and React | `tests/e2e/frameworks.spec.ts` and `examples/*/e2e`                                             |
| 13  | No tool definition is duplicated between WebMCP and the agent              | `tests/e2e/frameworks.spec.ts` checks `playground/src/assistant.ts`                             |
| 14  | No voice-related dependencies are introduced in Phase 1                    | `tests/e2e/frameworks.spec.ts` package dependency scan                                          |

## Run the checks

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:native
```

`test:e2e` runs both browser configurations. It also removes the API in a separate test to check the unsupported message. That test is not native compatibility evidence. `test:native` requires a real successful native run. It fails if the required API is absent. No native test is silently skipped.

For a manual check, run `pnpm probe`. Open the loopback address in the target browser. Select **Run probe**. Record the exact browser build and launch flags with the report.

## Next adapter task

Keep native format conversion inside `packages/webmcp`. Parse a discovered JSON-string schema once. Forward that schema instead of writing a second definition. Pass JSON-string arguments only for the verified legacy format. Preserve the native tool handle and current-window check. Do not infer safety from missing annotations. The runtime must require confirmation for tools without an explicit read-only classification.

The registry revision covers normalized tool content. The future source must also invalidate its execution revision when native registrations change, even if the public name and schema stay the same.
