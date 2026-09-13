# Installation

> One package, added to an application that already registers WebMCP tools.

## Requirements

| Requirement | Value                                                |
| ----------- | ---------------------------------------------------- |
| Node.js     | 22.12 or later in the 22 line, 24, or 26 and later   |
| Browser     | A secure context with native `document.modelContext` |
| Module type | ESM. Import from a bundler or a native module page.  |
| Model       | An OpenAI-compatible HTTP endpoint that you operate  |

The browser requirement is the strict one. Read [Browser setup](/guide/browser-setup)
before you install anything.

## Install

::: code-group

```sh [pnpm]
pnpm add action-wire
```

```sh [npm]
npm install action-wire
```

```sh [yarn]
yarn add action-wire
```

```sh [bun]
bun add action-wire
```

:::

That is the whole install. The widget, the headless bridge, the WebMCP source,
the model adapter, and the types all come from this one package. Its only
runtime dependency is `@cfworker/json-schema`, which validates tool input
without generating code, so it works under a strict Content-Security-Policy.

<ReadMore to="/reference/" title="What the package exports" />
## Check the install

Put this on a page that already registered at least one WebMCP tool:

```ts [check.ts]
import { createWebMCPSource } from 'action-wire';

const source = createWebMCPSource();
const snapshot = await source.discover();
console.log(snapshot.tools.map((tool) => tool.name));
source.dispose();
```

The console prints the tool names the page registered. An empty array means the
page registered nothing yet, or the tools belong to a different window. A thrown
`UNSUPPORTED_WEBMCP` error means the browser does not expose the API.

<ReadMore to="/guide/browser-setup" title="Browser setup" />
