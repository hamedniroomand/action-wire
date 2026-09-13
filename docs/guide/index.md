# What Action Wire is

> A text assistant that calls the WebMCP tools a web application already registered.

A web application already knows how to do the things people ask of it. A project
dashboard can create a project, rename it, open the billing view, and delete a
project. Each action exists as a button and a function behind that button.

[WebMCP](https://webmachinelearning.github.io/webmcp/) lets the page publish
those same actions to the browser. `document.modelContext.registerTool` gives an
action a name, a description, an input schema, and a handler.

Action Wire puts a chat assistant on top of that list:

1. A person types a request.
2. A model reads the tool list from the page and chooses a tool.
3. The browser asks the person to approve the call when the tool can change data.
4. The handler the application registered runs.
5. The result goes back to the model, which answers.

The application defines each tool one time. The assistant holds no second copy.

## Why the single definition matters

The usual way to give a model access to an application is to write the tool
schemas again, in a server prompt or an agent config. Two definitions of the
same action then exist. They drift. A field renamed in the form is still the old
name in the prompt, and the model sends input the handler rejects.

Here the schema and the handler are the ones the page registered. A change to
the application changes what the assistant can do, in the same commit, with no
second file to remember.

## Who this helps

<CardGroup :cols="2">

<Card title="Teams with an application that already works" icon="app-window">

You do not rewrite features for the assistant. You register the actions you
have. The rules that already guard those actions keep guarding them.

</Card>

<Card title="Developers who want a chat interface, not an agent platform" icon="message-square">

The product is a Web Component and about 1,800 lines of TypeScript. It mounts
with one function call. There is no account system and no service to run.

</Card>

<Card title="Developers who already write WebMCP tools" icon="plug">

The assistant discovers your tools at mount and again on every `toolchange`
event. Contextual tools that exist on one route work like global ones.

</Card>

<Card title="Teams that must write down the safety story" icon="shield" to="/guide/confirmations">

Destructive tools need approval. Approval expires when the tool list changes.
The model requests a call. It never runs one.

</Card>
</CardGroup>

## What the person using your app gets

They type what they want in ordinary words. The assistant shows which tool it
plans to run and what it did. Before anything destructive, it asks. The panel
works with a keyboard and a screen reader, and it fills the screen on a phone.

## What this is not

- It is not a WebMCP polyfill. The browser must supply the API. See
  [Browser setup](/guide/browser-setup).
- It has no voice, speech, or WebRTC support.
- It does not save conversations. A page refresh clears the transcript.
- It does not run your tools on a server. Handlers run in the page, in the
  browser, as the signed-in person.

::: note
The assistant needs a model. You supply an OpenAI-compatible endpoint that you
operate. Your API key stays on that server and never reaches browser code. See
[Model endpoint](/guide/model-endpoint).
:::

<ReadMore to="/guide/installation" title="Installation" />
