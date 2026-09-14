<p align="center">
  <img
    src="brand/mark.png"
    alt="Action Wire"
    width="160"
  />
</p>

# Action Wire

A text assistant widget that uses the WebMCP tools already registered on a page. The application owns tool schemas and handlers. The assistant discovers them. Do not define the same tools again in the agent.

Voice is out of scope. The assistant does not persist conversation history across sessions.

## Requirements

- Node.js 22.12+ in the 22 release line, Node.js 24, or Node.js 26+.
- pnpm 12.4.1 for this repository.
- A secure browser context with native `document.modelContext`. Chromium 153 with `--enable-experimental-web-platform-features` is the verified environment. See [compatibility](docs/project/compatibility.md).

## Install

```sh
npm install actionwire
```

One package holds the widget, the headless bridge, the WebMCP source, the model adapter, and the types. It is ESM only. Its only runtime dependency is `@cfworker/json-schema`, which validates tool input without `eval`, so the widget works under a strict Content-Security-Policy.

## Quick start

See the [quickstart](docs/guide/quickstart.md).

```ts
import { createAssistant, openAICompatible } from 'actionwire';

const assistant = createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
});
assistant.mount();
```

Register tools on the page with native WebMCP before discovery. Keep model credentials on a Node.js endpoint. Do not put API keys in browser code.

## Exports

`createAssistant` mounts the widget. `createAgentBridge` is the same runtime with no interface. `createWebMCPSource` reads the tools on the page. `openAICompatible` talks to your model endpoint. `AgentError` carries every failure code. The types come from the same entry point.

Inside `packages/actionwire/src` the code keeps four layers: `core`, `webmcp`, `agent`, and `widget`. They import in one direction only, and a lint rule enforces it.

## Examples

Each example has its own README with the port and the run command.

- [`examples/vanilla`](examples/vanilla/README.md)
- [`examples/react`](examples/react/README.md)
- [`examples/vue`](examples/vue/README.md)
- [`examples/svelte`](examples/svelte/README.md)
- `playground`: project dashboard used by the journey test.

An example loads the built package, so run `pnpm build` before `pnpm vanilla:dev` or any of the others.

## Develop

```sh
pnpm install
pnpm build
pnpm test
```

`pnpm test:e2e` runs the Playwright suites. `pnpm test:native` runs the checks that need flagged Chromium; it fails when the API is absent instead of skipping. Read [development](docs/project/development.md) for the rest.

## Documentation

The site is a VitePress project in [`docs/`](docs). Run it from the repository root:

```sh
pnpm --filter actionwire-docs dev
```

- [Introduction](docs/guide/index.md): what this is and who it helps.
- [Installation](docs/guide/installation.md)
- [Browser setup](docs/guide/browser-setup.md): the Chrome flag, on every system.
- [Quickstart](docs/guide/quickstart.md)
- [Model endpoint](docs/guide/model-endpoint.md): the server you operate.
- [Confirmations](docs/guide/confirmations.md): how a destructive tool is approved.
- [Without native WebMCP](docs/guide/without-webmcp.md)
- [Frameworks](docs/guide/frameworks.md)
- [Styling](docs/guide/styling.md)
- [Troubleshooting](docs/guide/troubleshooting.md)
- [API reference](docs/reference/index.md)
- [Architecture](docs/project/architecture.md)
- [Compatibility](docs/project/compatibility.md)
- [Development](docs/project/development.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).

Source: [github.com/hamedniroomand/action-wire](https://github.com/hamedniroomand/action-wire)
