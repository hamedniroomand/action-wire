# Changelog

## 0.1.0 - 2026-09-13

First MVP release. Not published to npm until package-name ownership is confirmed. See [docs/release-checklist.md](docs/release-checklist.md).

### Added

- `@webmcp-agent/core`: shared types, registry, events, and errors.
- `@webmcp-agent/webmcp`: native `document.modelContext` discovery and execution.
- `@webmcp-agent/agent`: headless bridge and OpenAI-compatible Node endpoint adapter.
- `webmcp-agent`: Web Component widget with confirmation, tool cards, and session UI.
- Playground project dashboard with single-source WebMCP tools.
- Vanilla JavaScript, React, Vue, and Svelte examples.
- Playwright native gate, failure matrix, and package smoke install.
- MIT license, quickstart, architecture, headless, confirmation, and troubleshooting docs.

### Notes

- Requires a secure context and native WebMCP. Chromium 153 with `--enable-experimental-web-platform-features` is the verified host.
- Voice and persisted conversation history are out of scope.
- `cancel()` does not roll back application actions that already completed.
