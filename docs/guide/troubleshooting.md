# Troubleshooting

> Find the symptom, then the cause.

Every failure the assistant shows maps to one error code. The full list is in
the [error reference](/reference/errors).

## "This browser does not support WebMCP."

Code `UNSUPPORTED_WEBMCP`.

`document.modelContext` is absent or incomplete, or the page is not a secure
context.

- Confirm the browser started with the flag. Run
  `typeof document.modelContext?.registerTool` in the console. It must print
  `"function"`.
- Confirm every Chrome window was closed before you ran the command. Chrome
  reuses a running process and drops your flags without a message.
- Confirm the origin. `http://127.0.0.1` and `http://localhost` are secure. A
  LAN address such as `http://192.168.1.10` is not.

<ReadMore to="/guide/browser-setup" title="Browser setup" />
If your users cannot use a flag, supply your own
[tool source](/guide/without-webmcp).

## "The assistant could not read the tools on this page."

Code `DISCOVERY_FAILED`. `getTools()` threw, or it returned something that is
not a list. Check the console for an error from your own registration code.

## "This tool is not available."

Code `TOOL_UNAVAILABLE`. The model asked for a tool that is not in the current
list.

- Register tools before `mount()`.
- After a route change, confirm the new route registered its tools.
- Confirm the tool belongs to the current window. The source skips tools
  registered by a frame.

## "The tool input is not valid."

Code `INVALID_ARGUMENTS`. The model produced arguments that fail your schema.
Usually the description is too vague for the model to fill the fields. Name the
required fields in the description and give the expected format.

## "A tool definition is not valid."

Code `INVALID_SCHEMA`. A registered schema is not a JSON object, or it declares
a dialect the validator does not accept. Supported dialects are JSON Schema
2020-12, which is the default, and draft-07. The assistant does not rewrite your
schema.

## "The tool list changed. Try again."

Code `STALE_TOOLS`. The tool list moved after the model chose a tool, or while a
confirmation was on screen. This is the safety check working. Send the request
again.

If it happens on every turn, your page is re-registering tools in a loop.
Register once, and abort with an `AbortSignal` instead of registering again.

## "The assistant could not complete the turn."

Code `MODEL_ERROR`. The `/api/assistant` route failed, returned text that is not
JSON, or could not reach the provider.

- Confirm the dev-server proxy forwards `/api/assistant` to your Node route.
- Confirm `ACTION_WIRE_UPSTREAM_URL` and `ACTION_WIRE_API_KEY` on the server.
- Read the server log. The browser is told the request failed and nothing more,
  on purpose.

## "The assistant reached the turn limit."

Code `TURN_LIMIT`. The model asked for more than `maxRounds` rounds of tool
calls in one turn. The default is 8.

A model that loops usually cannot tell two tools apart, or it never receives the
result it expects. Read the tool cards to see what it repeated, then make those
descriptions distinct.

## "The assistant is busy."

Code `BUSY`. One turn runs at a time. Wait, or call `cancel()`.

## "The assistant timed out."

Code `TIMEOUT`. The model call or a tool call passed `timeoutMs`, which defaults
to 30000. A slow handler needs a higher `timeoutMs`, or less work in the
handler.

## The assistant works, but chooses the wrong tool

This is a description problem, not a code problem. The model sees only the name,
the description, and the schema.

- Write what the tool does and when to use it, not how it is built.
- Make near-duplicates distinct. "Open a project" and "Open the billing view"
  are clearer than two descriptions that both start with "Open".
- Turn on `developerMode` to read the exact arguments the model sent.
