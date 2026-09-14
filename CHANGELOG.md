# Changelog

## 0.2.0 - 2026-09-14

### Changed

- The widget is a bottom-center bar, 40px tall. It is collapsed to a 2px wire by
  default. `⌘/` (`Ctrl+/` on Windows and Linux) toggles it. Escape denies a
  confirmation, then closes the transcript, then collapses the bar.
- The reply shows as one line in the bar. The transcript opens on request and
  draws messages and tool calls on one vertical wire. No message bubbles.
- Confirmation and errors reuse the bar. Nothing grows past 40px.
- The bar is not modal. There is no focus trap. The page stays usable behind it.
- `--aw-radius` default is `12px`.

### Added

- CSS variables `--aw-bar-width`, `--aw-bar-height`, `--aw-bar-bottom`, and
  `--aw-transcript-max-height`.
- Package subpath exports: `actionwire/core`, `actionwire/webmcp`,
  `actionwire/agent`, and `actionwire/widget`.

### Removed

- CSS variables `--aw-launcher-size`, `--aw-avatar-size`, `--aw-panel-width`,
  `--aw-panel-max-height`, `--aw-radius-bubble`, and `--aw-color-user`.

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
