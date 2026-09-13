# Styling

> Set CSS variables on the host element. The panel lives in a shadow root, so nothing else reaches it.

```css [app.css]
action-wire {
  --aw-color-accent: #7c3aed;
  --aw-panel-width: 380px;
  --aw-panel-max-height: 640px;
  --aw-radius: 12px;
}
```

## Variables

| Variable                 | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `--aw-color-accent`      | Launcher fill, send button, focus ring.       |
| `--aw-color-accent-text` | Text drawn on the accent colour.              |
| `--aw-color-surface`     | Panel background.                             |
| `--aw-color-text`        | Primary text.                                 |
| `--aw-color-muted`       | Secondary text, timestamps, tool card labels. |
| `--aw-color-border`      | Panel border and dividers.                    |
| `--aw-color-user`        | Background of the person's message bubble.    |
| `--aw-font`              | Font stack for the whole panel.               |
| `--aw-radius`            | Corner radius of the panel and cards.         |
| `--aw-radius-full`       | Corner radius of round controls.              |
| `--aw-shadow`            | Panel shadow.                                 |
| `--aw-space`             | Base spacing step.                            |
| `--aw-panel-width`       | Panel width on a desktop screen.              |
| `--aw-panel-max-height`  | Maximum panel height.                         |
| `--aw-launcher-size`     | Diameter of the closed launcher button.       |

The definitions live in `packages/action-wire/src/widget/styles.ts`.

## Layout rules you do not control

At 640px and below the panel becomes a bottom sheet with safe-area padding, so
the composer stays above a virtual keyboard. The timeline scrolls; the page
behind it does not.

The panel is a modal dialog. It traps Tab, closes on Escape, and returns focus
to the launcher. Status changes are announced through a live region. These
behaviours are not configurable, because turning any of them off breaks keyboard
and screen-reader use.

::: tip
The widget respects `prefers-reduced-motion`. Do not add your own transitions to
the host element without the same guard.
:::

## Developer mode

```ts
createAssistant({ model, developerMode: true }).mount();
```

Tool cards then show the raw JSON arguments and results instead of a text
summary. Use it while you write tool descriptions. Leave it off in production:
raw arguments can contain data a person should not see in a chat panel.
