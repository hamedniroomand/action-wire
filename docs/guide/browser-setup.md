# Browser setup

> WebMCP is not on by default. Start Chrome with one flag and a separate profile.

Action Wire uses the browser API. It does not supply one. If
`document.modelContext` is absent, the widget shows "This browser does not
support WebMCP." and stops.

Today that API is behind a flag. You turn it on when you start the browser.

::: warning
Only one configuration is verified for this project: Chromium 153.0.8010.12
with `--enable-experimental-web-platform-features`, on a `http://127.0.0.1`
origin. The commands below are the same flag on other systems. Read
[Compatibility](/project/compatibility) for what was measured and what was not.
:::

## Start Chrome with the flag

Close every running Chrome window first, then run the command for your system.

<Tabs>
<Tab label="macOS" icon="apple">

```sh [Terminal]
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --enable-experimental-web-platform-features \
  --user-data-dir=/tmp/webmcp-chrome \
  http://127.0.0.1:4175
```

</Tab>

<Tab label="Windows" icon="app-window">

```powershell [PowerShell]
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --enable-experimental-web-platform-features `
  --user-data-dir="$env:TEMP\webmcp-chrome" `
  http://127.0.0.1:4175
```

```bat [Command Prompt]
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --enable-experimental-web-platform-features ^
  --user-data-dir="%TEMP%\webmcp-chrome" ^
  http://127.0.0.1:4175
```

On a 32-bit install, the program is under
`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`.

</Tab>

<Tab label="Linux" icon="terminal">

```sh [Terminal]
google-chrome \
  --enable-experimental-web-platform-features \
  --user-data-dir=/tmp/webmcp-chrome \
  http://127.0.0.1:4175
```

Some distributions name the program `google-chrome-stable`, `chromium`, or
`chromium-browser`. A Flatpak install runs through
`flatpak run com.google.Chrome`, and a Snap install keeps the same flags.

</Tab>
</Tabs>

## What each part does

**`--enable-experimental-web-platform-features`** turns on browser features that
are not yet stable. `document.modelContext` is one of them. Without this flag
the API is absent.

**`--user-data-dir=<path>`** uses a separate, empty browser profile at that path.
This matters more than it looks. If Chrome is already running, a new command
opens a tab in the existing process and your flags are ignored with no message.
A separate profile forces a new process, so the flags apply.

**`http://127.0.0.1:4175`** is the page to open. WebMCP needs a secure context.
`http://127.0.0.1` and `http://localhost` count as secure. Every other host
needs HTTPS.

::: caution
The separate profile has no extensions, no bookmarks, and no signed-in accounts.
That is deliberate: experimental flags change how the browser behaves, so keep
them away from the profile you use every day. Delete the folder when you finish.
:::

## Confirm it worked

Open DevTools on the page and run:

```js [DevTools console]
typeof document.modelContext?.registerTool;
```

`"function"` means the API is present. `"undefined"` means the flag did not
apply. Go back and check that every Chrome window was closed before you ran the
command.

This project also ships a probe page that reports the same thing with a full
trace of registration, discovery, and execution:

```sh
pnpm probe
```

Open `http://127.0.0.1:4173` in the flagged browser and select **Run probe**.

## Other browsers

Firefox and Safari do not expose `document.modelContext`. They are not in the
release matrix, and this project does not polyfill the API.

::: tip
You can still ship the assistant to people whose browser has no WebMCP. Supply
your own tool source instead of the native one. See
[Without native WebMCP](/guide/without-webmcp).
:::

## Notes for later Chrome versions

The [Chrome documentation](https://developer.chrome.com/docs/ai/webmcp) also
describes an origin trial, origin isolation, and a `tools` permissions policy.
This project tested none of those. It tested the command-line flag.

Chrome 155 changes the argument format for tool execution. The adapter reads the
format from each discovered tool and sends the matching one, so both the old and
the new format work with no change on your side.
