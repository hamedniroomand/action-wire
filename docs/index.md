---
layout: home

hero:
  name: Action Wire
  text: One set of tools. Two ways to use them.
  tagline: >-
    Your application registers its actions once with WebMCP. People click them.
    The assistant calls the same handlers, with the same permissions, and asks
    before anything destructive.
  image:
    src: /icon.svg
    alt: Action Wire
  actions:
    - theme: brand
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: What Action Wire is
      link: /guide/
    - theme: alt
      text: GitHub
      link: https://github.com/hamedniroomand/action-wire
---

```ts [app.ts]
import { openAICompatible } from 'action-wire';
import { createAssistant } from 'action-wire';

createAssistant({
  model: openAICompatible({ endpoint: '/api/assistant' }),
}).mount();
```

## What you get

<CardGroup :cols="2">

<Card title="No second copy of your tools" icon="copy-slash">

The assistant discovers the schemas and handlers the page already registered.
You do not write them again for the model, and the two cannot drift apart.

</Card>

<Card title="The browser decides, not the model" icon="shield-check">

Model output is a request. Destructive tools need explicit approval, approval
expires when the tool list changes, and your application authorization still
applies.

</Card>

<Card title="Any framework, or none" icon="boxes">

The widget is a Web Component with no framework dependency. Vanilla
JavaScript, React, Vue, and Svelte examples run against the same build.

</Card>

<Card title="Bring your own interface" icon="terminal">

The headless bridge exposes state and methods without any UI. Render the
transcript, the tool cards, and the confirmations yourself.

</Card>

</CardGroup>
