# AhaSwarm

A cleaner, smoother frontend for [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI), packaged as a SwarmUI extension.
It reimplements the Generate tab on top of SwarmUI's normal HTTP/WebSocket API, so it runs side by side with the classic UI.

Mobile layout is planned.

## Install

1. Copy (or `git clone`) this folder to `SwarmUI/src/Extensions/AhaSwarm/`.
2. Build the frontend once (see [Build the frontend](#build-the-frontend)): `cd frontend && npm ci && npm run build`.
3. Restart SwarmUI. Swarm builds the C# part of the extension automatically.
4. Open `http://<swarmui-url>/Aha/`, or click the **AhaSwarm ↗** tab that the extension adds to the classic UI.

Launch mode: to have SwarmUI open AhaSwarm instead of the classic UI when it starts, pick `aha` as the Launch Mode in
Server Configuration, or start SwarmUI with `--launch_mode aha`.

The built web app (`Assets/app/`) is not committed, so you need Node.js to build it once, and again after updating.
There is no prebuilt download yet (see To Do).

> Updating the C# side: Swarm only rebuilds extensions when its build folder is missing. If `AhaSwarm.cs` changed,
> delete `SwarmUI/src/bin/extensions/SwarmExtensionAhaSwarm/` (or use Swarm's update/rebuild) and restart.
> Frontend-only changes don't need a restart, because files in `Assets/app/` are read from disk on each request.

## Build the frontend

Requires Node.js 18, 20 or 22+ (the versions Vite 6 supports).

```bash
cd frontend
npm ci
npm run build      # outputs to ../Assets/app (relative base paths, plus a legacy bundle for older browsers)
npm run check      # svelte-check / TypeScript
```

Dev server with hot reload, proxied to a running Swarm:

```bash
cd frontend
SWARM_URL=http://127.0.0.1:7801 npm run dev
```

Open `http://localhost:5173/Ahadev/` while `npm run dev` is running. The dev server proxies `/API`, `/View`
and the other Swarm endpoints to `SWARM_URL`, so you get live reloads without rebuilding `Assets/app`.

The dev server always uses Vite's default port 5173. The extension also maps `/Ahadev/` on the Swarm port,
but that proxy only works when the extension is loaded and can reach the dev server; if
`http://127.0.0.1:7801/Ahadev/` does not load, use the Vite URL above.

## Browser support

Targets current evergreen browsers. A legacy bundle with polyfills covers older engines (because why not), down to about iOS/Safari 12, Chrome 64, Firefox 68 and Samsung Internet 9 (the floor is Svelte 5's need for `Proxy`). (Polyfills might get removed later on)

## License

MIT, see the `LICENSE` file.

## Credits

AhaSwarm is built on [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) by mr Alex "mcmonkey" Goodwin (MIT), whose server, API and classic frontend it follows as the spec (usually), and [ComfyUI](https://github.com/comfyanonymous/ComfyUI) by comfyanonymous (GPL-3.0), SwarmUI's main generation backend.

The app uses [Svelte](https://svelte.dev) (MIT) and [Lucide](https://lucide.dev) icons (ISC); the build uses [Vite](https://vite.dev), [Tailwind CSS](https://tailwindcss.com), [TypeScript](https://www.typescriptlang.org) and `svelte-check`.

Theme palettes are adapted from [Catppuccin](https://catppuccin.com), [Gruvbox](https://github.com/morhetz/gruvbox), [Rosé Pine](https://rosepinetheme.com), One Dark, [Adwaita for Steam](https://github.com/tkashkin/Adwaita-for-Steam) (plus [vgui.css](https://github.com/AlpyneDreams/vgui.css)), [MoreThemes](https://github.com/mrblomblo/MoreThemes), GNOME [libadwaita](https://gitlab.gnome.org/GNOME/libadwaita) (LGPL-2.1-or-later) and [shadcn/ui](https://ui.shadcn.com).

No fonts are bundled; the UI uses the system font stack. (This might change because I might force everyone to use Inter)
