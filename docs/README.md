# AhaSwarm docs (for coding agents)

Start here before changing the repo. Most UI work needs the first two files.

| File | What it covers |
|---|---|
| [components.md](components.md) | Every AhaKit component: purpose, main props/events, usage from the app |
| [writing-components.md](writing-components.md) | Writing a new component: location, runes, props/snippets, tokens, styling, exporting, README entry |
| [api.md](api.md) | API layer: session, `request`/`requestWS`, errors, adding endpoints, the C# side, SwarmUI routes used |
| [ui-rules.md](ui-rules.md) | UI/UX rules from the project owner (density, icons, colours, tooltips, popups, no hacks) |
| [classic-parity.md](classic-parity.md) | Where to find classic SwarmUI's reference behaviour in its source |
| [architecture.md](architecture.md) | Short overview: C# extension, frontend layers, data flow |
| [workflow.md](workflow.md) | Short: build, dev server, checks |

Short version: reuse AhaKit, put reusable pieces in AhaKit, go through `api` for server calls, match classic SwarmUI
behaviour, keep the UI compact, and run `npm run check` and `npm run build` in `frontend/`.

## For Users

| File | What it covers |
|---|---|
| [theming.md](theming.md) | Making a theme, high contrast, and other stuff |
