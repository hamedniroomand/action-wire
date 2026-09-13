# Changelog

## 0.1.0 - 2026-09-13

First MVP release.

### Added

- `action-wire`: one package holding the shared types and tool registry, native
  `document.modelContext` discovery and execution, the headless bridge with an
  OpenAI-compatible endpoint adapter, and the Web Component widget with
  confirmation, tool cards, and the session interface.
- Playground project dashboard with single-source WebMCP tools.
- Vanilla JavaScript, React, Vue, and Svelte examples.
- Playwright native gate, failure matrix, and package smoke install.
- MIT license, quickstart, architecture, headless, confirmation, and troubleshooting docs.

### Notes

- Requires a secure context and native WebMCP. Chromium 153 with `--enable-experimental-web-platform-features` is the verified host.
- Voice and persisted conversation history are out of scope.
- `cancel()` does not roll back application actions that already completed.
