# Action Wire

A text assistant widget that uses the WebMCP tools already registered on a page. The application owns tool schemas and handlers. The assistant discovers them. Do not define the same tools again in the agent.

Voice is out of scope. The assistant does not persist conversation history across sessions.

## Requirements

- Node.js 22.12+ in the 22 release line, Node.js 24, or Node.js 26+.
- pnpm 12.4.1 for this repository.
- A secure browser context with native `document.modelContext`. See [compatibility](docs/3.project/2.compatibility.md).

## Install

```sh
npm install action-wire @action-wire/agent
```

Publish order is `@action-wire/core`, then `@action-wire/webmcp` and `@action-wire/agent`, then `action-wire`.

## Quick start

See the [quickstart](docs/1.guide/4.quickstart.md).

```ts
import { openAICompatible } from '@action-wire/agent';
import { createAssistant } from 'action-wire';

const assistant = createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
});
assistant.mount();
```

Register tools on the page with native WebMCP before discovery. Keep model credentials on a Node.js endpoint. Do not put API keys in browser code.

## Packages

- `@action-wire/core`: types, registry, events, errors.
- `@action-wire/webmcp`: native discovery and execution.
- `@action-wire/agent`: headless bridge and OpenAI-compatible adapter.
- `action-wire`: Web Component widget facade.

## Examples

- `examples/vanilla`
- `examples/react`
- `examples/vue`
- `examples/svelte`
- `playground`: project dashboard used by the journey test.

## Documentation

The full site is in [`docs/`](docs). Run it with `cd docs && pnpm install && pnpm dev`.

- [Introduction](docs/1.guide/1.index.md): what this is and who it helps.
- [Browser setup](docs/1.guide/3.browser-setup.md): the Chrome flag, on every system.
- [Quickstart](docs/1.guide/4.quickstart.md)
- [Without native WebMCP](docs/1.guide/7.without-webmcp.md)
- [Troubleshooting](docs/1.guide/10.troubleshooting.md)
- [API reference](docs/2.reference/1.index.md)
- [Architecture](docs/3.project/1.architecture.md)
- [Compatibility](docs/3.project/2.compatibility.md)
- [Development](docs/3.project/3.development.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).

Source: [github.com/hamedniroomand/action-wire](https://github.com/hamedniroomand/action-wire)
