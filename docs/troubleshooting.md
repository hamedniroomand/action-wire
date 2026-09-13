# Troubleshooting

## Unsupported browser

Symptom: the widget shows "This browser does not support WebMCP." The error code is `UNSUPPORTED_WEBMCP`.

Cause: `document.modelContext` is absent, incomplete, or the context is not secure.

Action: use Chromium with `--enable-experimental-web-platform-features` on a `http://127.0.0.1` origin, or another verified native host. See [compatibility](compatibility.md). The product does not polyfill WebMCP.

## Endpoint errors

Symptom: "The assistant could not complete the turn." The error code is `MODEL_ERROR`.

Cause: `/api/assistant` failed, returned non-JSON, or the Node server cannot reach the upstream model.

Action: confirm the Vite proxy or host route posts to the Node endpoint. Check `WEBMCP_AGENT_UPSTREAM_URL` and `WEBMCP_AGENT_API_KEY` on the server. Do not put the key in browser code.

A timeout shows "The assistant timed out." (`TIMEOUT`). An abort shows "The assistant was cancelled." (`ABORTED`).

## Missing tools

Symptom: "This tool is not available." (`TOOL_UNAVAILABLE`) or "The assistant could not read the tools on this page." (`DISCOVERY_FAILED`).

Cause: the page did not register the tool, navigation removed it, or `getTools()` failed.

Action: register tools before `mount()`. Call `refreshTools()` after route changes. Contextual tools must unregister with their `AbortSignal` when the route leaves.

## Invalid input or schema

- `INVALID_ARGUMENTS`: the model arguments do not match the tool schema.
- `INVALID_SCHEMA`: a native tool schema is not a JSON object, or it uses an unsupported `$schema` dialect. Supported dialects are JSON Schema 2020-12 (default) and draft-07. Unknown dialects fail. The assistant does not rewrite the application schema.

## Stale tools

`STALE_TOOLS` means the tool list changed after the model chose a tool or after the user saw a confirmation. Discover again and send a new request.

## Busy and turn limit

- `BUSY`: a user turn is already running. Wait, or call `cancel()`.
- `TURN_LIMIT`: the model requested more than `maxRounds` tool rounds. Default is 8.
