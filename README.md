# bb-plugin-fontsize

Scale the whole [bb](https://github.com/get-bb/bb) interface from a button in
the sidebar footer.

bb has no built-in interface font-size setting — Settings → Appearance only
covers themes and palettes. This plugin adds one, without forking bb.

## What it does

- **A sidebar footer button**, in the same group as Settings and Remote access.
  One click steps through **Small (13px) → Default (16px) → Large (18px) →
  Extra large (20px)** and wraps around.
- **A settings panel** (Extensions → Plugins → Font size) with the same presets
  plus ±1px fine control from 11px to 24px, and a Reset.

Both scale the entire app — sidebar, chat, composer, panels. bb's UI is
Tailwind with rem-based type scales and no explicit `html { font-size }`, so
setting the root font size scales everything proportionally rather than
zooming pixels.

## Install

```sh
bb plugin install git:https://github.com/jmporchet/bb-plugin-fontsize.git@main
```

Then reload your bb window. Installing from git needs `npm` on your `PATH` —
bb runs `npm install` and builds the frontend bundle for you.

To update later:

```sh
bb plugin outdated
bb plugin update fontsize
```

To remove it:

```sh
bb plugin remove fontsize
```

Uninstalling or disabling the plugin restores the default size immediately —
the content script's disposer hands the root element back to the browser.

## The size is per device, not per server

The chosen size lives in each client's `localStorage` under
`bb-plugin-fontsize:root-px`, not in bb's plugin settings. Plugin settings are
stored server-side and shared by every client connected to that server, which
is wrong for a preference that belongs to the screen you are looking at — your
laptop and your phone should not have to agree on a font size.

Open bb windows stay in sync with each other via the `storage` event, so
changing the size in one window updates the others on the same device.

## Requirements

- bb `>= 0.36`
- bb plugin SDK `^0.4.1`

## Known limitations

- **Button position.** bb renders the sidebar footer as Settings → plugin
  actions → Report a bug. This plugin's button lands in that middle group, but
  its position relative to other plugins' buttons (such as Remote access) is
  decided by bb's plugin ordering — the `sidebarFooterAction` slot has no
  ordering or priority field.
- **No popover.** `sidebarFooterAction` is host-rendered chrome: `run` receives
  no anchor element, so there is no way to open a dropdown from the button
  itself. Hence cycle-on-click, with the full selector in settings.
- **Very large sizes reflow the sidebar.** At 22–24px the sidebar and composer
  get noticeably chunkier. That is the intended trade-off of scaling rather
  than zooming; use the ±1px control to find a size you like.

## Development

```sh
git clone https://github.com/jmporchet/bb-plugin-fontsize.git
cd bb-plugin-fontsize
npm install
bb plugin install .     # register this directory in place
bb plugin dev           # rebuild + reload on every save
```

Useful checks:

```sh
npm run typecheck
npm test
npm run build           # emits dist/app.js, dist/app.css, dist/server.js
bb plugin logs fontsize -f
```

`types/*.d.ts` are a snapshot of the plugin SDK surface for your bb version.
Refresh them against a newer bb with `bb plugin types`.

## How it works

| File | Role |
| --- | --- |
| [`lib/font-scale.ts`](lib/font-scale.ts) | Read, clamp, apply, persist and observe the root font size. All the logic, no bb dependency — this is what the tests cover. |
| [`app.tsx`](app.tsx) | Registers a `contentScripts` entry (applies the size to the app shell), a `sidebarFooterAction` (the cycle button) and a `settingsSection` (the selector). |
| [`server.ts`](server.ts) | Intentionally empty. `bb.server` is a required manifest field, but nothing about a per-device font size needs a server. |
| [`assets/icon.svg`](assets/icon.svg) | The `Aa` glyph. bb's icon registry has no text/font icon, so the plugin ships its own; bb serves it hashed and renders it as a CSS mask so it inherits the sidebar's text colour. |

The content script is the load-bearing piece: the plugin SDK exposes no
font-size API, and `app.contentScripts.register` is the sanctioned way to run
trusted same-origin code against the bb app shell. It sets exactly one
property on one element and removes it again on dispose.

## License

MIT © Jean-Marie Porchet
