# WebMCP Agent

A text assistant widget that uses the WebMCP tools already registered on a page. The application owns tool schemas and handlers. The assistant discovers them. Do not define the same tools again in the agent.

Voice is out of scope. The assistant does not persist conversation history across sessions.

## Requirements

- Node.js 22.12+ in the 22 release line, Node.js 24, or Node.js 26+.
- pnpm 12.4.1 for this repository.
- A secure browser context with native `document.modelContext`. See [compatibility](docs/compatibility.md).

## Install

```sh
npm install webmcp-agent @webmcp-agent/agent
```

Publish order is `@webmcp-agent/core`, then `@webmcp-agent/webmcp` and `@webmcp-agent/agent`, then `webmcp-agent`.

## Quick start

See [docs/quickstart.md](docs/quickstart.md).

```ts
import { openAICompatible } from '@webmcp-agent/agent';
import { createAssistant } from 'webmcp-agent';

const assistant = createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
});
assistant.mount();
```

Register tools on the page with native WebMCP before discovery. Keep model credentials on a Node.js endpoint. Do not put API keys in browser code.

## Packages

- `@webmcp-agent/core`: types, registry, events, errors.
- `@webmcp-agent/webmcp`: native discovery and execution.
- `@webmcp-agent/agent`: headless bridge and OpenAI-compatible adapter.
- `webmcp-agent`: Web Component widget facade.

## Examples

- `examples/vanilla`
- `examples/react`
- `examples/vue`
- `examples/svelte`
- `playground`: project dashboard used by the journey test.

## Documentation

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Headless API](docs/headless.md)
- [Confirmations](docs/confirmations.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Compatibility](docs/compatibility.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).
