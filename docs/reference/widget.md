# Widget

> `createAssistant` from `action-wire`.

```ts
import { createAssistant } from 'action-wire';

const assistant = createAssistant(options);
```

It returns a `MountedAssistant`: every method of the
[headless bridge](/reference/headless), plus `mount` and `unmount`.

## Options

| Option                 | Type                 | Default       | Effect                                                       |
| ---------------------- | -------------------- | ------------- | ------------------------------------------------------------ |
| `model`                | `AgentAdapter`       | required      | Where turns are generated.                                   |
| `source`               | `ToolSource`         | native source | Where tools come from.                                       |
| `requiresConfirmation` | `ConfirmationPolicy` | none          | Extra confirmation checks. Cannot skip a consequential tool. |
| `developerMode`        | `boolean`            | `false`       | Show raw JSON on tool cards.                                 |
| `maxRounds`            | `number`             | `8`           | Model rounds allowed in one user turn.                       |
| `timeoutMs`            | `number`             | `30000`       | Timeout for the model call and each tool call.               |

Leaving `source` empty builds `createWebMCPSource()` on first use. Nothing reads
`document.modelContext` until then.

## Mount methods

| Method           | Effect                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `mount(target?)` | Appends the host element to `target`, or to `document.body`. Repeat calls move the existing element. |
| `unmount()`      | Removes the element. The session and the tool source stay alive.                                     |

`dispose()` removes the element, aborts work, drops the session, and disposes a
source the widget created itself. A source you passed in is yours to dispose.

## The element

The custom element is `action-wire`. It attaches an open shadow root, so
your page styles do not reach inside. Style it with the CSS variables listed
under [Styling](/guide/styling).

## Accessibility

- The launcher is a button labelled "Open assistant".
- The panel is `role="dialog"` with `aria-modal="true"` and a title.
- Tab is trapped inside the open panel. Escape denies a visible confirmation, or
  closes the panel when none is open. Focus returns to the launcher.
- Busy state is exposed with `aria-busy` and announced through a polite live
  region.
