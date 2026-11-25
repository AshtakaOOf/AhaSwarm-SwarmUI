# Architecture (overview)

Secondary to the component docs; read [api.md](api.md) for the API layer.

AhaSwarm is a SwarmUI extension that serves an alternative frontend (Svelte 5 + Vite + TypeScript + Tailwind 4) at `/Aha/`.
It talks to SwarmUI only through SwarmUI's normal HTTP/WebSocket API (`/API/*`), with the same session and permissions as
the classic UI. User data, settings, models and backends are shared with classic.

## Repo layout

```
AhaSwarm.cs / AhaSwarm.csproj  C# extension: serves the newest Assets/app build at /Aha/, proxies /Ahadev/ to the Vite dev server, handles the `aha` launch mode, and adds a link tab to the classic UI
Assets/aha-tab.js              classic-UI script that adds the "AhaSwarm ↗" tab
Assets/aha-login.js            login page "Log in to AhaSwarm" toggle
Assets/app/dist/               built frontend, committed by the Build frontend GitHub Action (`npm run build:dist`)
Assets/app/dev/                local builds (`npm run build`, gitignored)
frontend/                      Svelte 5 + Vite + TypeScript source
  src/lib/api/                 API layer only: session handling, HTTP + WebSocket calls, response types
  src/lib/state/               app state (Svelte runes): params, generation/queue, UI settings, shared actions
  src/lib/util/                small helpers (storage, metadata parsing, swipe gestures, browser back/forward guard)
  src/lib/editor/              image editor engine (canvas layers, brushes, selection, history; no UI), see image-editor.md
  src/lib/ahakit/              AhaKit, the AhaSwarm UI component library (import as $ahakit)
  src/components/ui.ts         the single place the app imports AhaKit components from ($ahakit)
  src/components/**            pages and composition. Their CSS is layout only, built from library components and tokens.
```

The C# side doesn't know anything about the UI. It serves static files, the tab link, the launch mode, per-user AhaSwarm settings, and the install-feature catalog (`AhaGetInstallFeatures`). All other data goes through
SwarmUI's standard API (`/API/*`), using the same session and permissions as the classic UI.

## C# side (repo root)

- `AhaSwarm.cs`: the `Extension` subclass.
  - `OnInit`: adds `Assets/aha-tab.js` (the "AhaSwarm ↗" tab in classic) and registers `Assets/aha-login.js` as an asset.
  - `OnInit` also reads `--aha_build dist|dev|auto` (default `auto`; read there so Swarm doesn't flag it unused).
  - Build choice: each build's `index.html` carries `<meta name="aha-build-time" content="<unix seconds>">` (a small Vite
    plugin). `auto` serves whichever of `Assets/app/dist/` and `Assets/app/dev/` is newer (or the only one present), checked per
    request but cached by `index.html` mtime; the served build is logged at startup and whenever it changes.
  - `OnPreLaunch`: maps `/Aha` and `/Aha/{*asset}` to files in the chosen build (path-checked with `WebServer.CheckFilePath`;
    `index.html`, `sw.js` and the web manifest are `no-cache`, hashed assets are immutable; custom theme files from `Data/AhaSwarm/themes/` are inlined
    into `index.html`, see theming.md), and maps `/Ahadev/` as a proxy to the Vite dev server on :5173. It also appends a
    deferred `aha-login.js` tag to `WebServer.PageHeaderExtra` (the only extension hook the login page renders): on the
    login page it adds a remembered "Log in to AhaSwarm" checkbox that sends a successful login to `Aha/`.
  - Launch mode `aha` (alias `web-aha`): `OnPreLaunch` opens `/Aha/` in the browser. Core lists Launch Mode options
    from a `[ManualSettingsOptions]` attribute (rebuilt on every read), so the extension wraps the registered
    `ListServerSettings` handler in `API.APIHandlers` to append `aha` to `LaunchMode.values`; classic's Server Configuration and
    AhaSwarm's Server Settings dropdowns both read that response. `ChangeServerSettings` doesn't validate dropdown values.
- `AhaSettingsAPI.cs`: `AhaGetSettings` / `AhaSaveSettings`, the user's AhaSwarm settings (`ui.settings`), one file per user
  in `Data/AhaSwarm/users/` (nothing in SwarmUI's own user data). `ui.loadSettings()` runs at boot (uploading this browser's settings if the user has none yet); `saveSettings()`
  writes localStorage (a cache for the first paint) and the server (debounced). Output toggles are `settings.output` in that file. A file without them is filled from this browser's classic localStorage keys, then saved. History thumb size and output image size are not written to the file.
  `AhaGetInstallFeatures` (`fundamental_generate_tab_access`) returns the ComfyUI installable-feature catalog and the
  `addInstallButton(...)` calls parsed from each extension's `ScriptFiles`. Installing is still core `ComfyInstallFeatures`.
- Apart from the settings and install-catalog routes, the C# side knows nothing about the UI: everything else goes through core SwarmUI routes.
- `AhaSwarm.csproj`: excludes `frontend/**`, `Assets/**` and `screenshots/**` from C# globbing.
- SwarmUI only rebuilds an extension when `SwarmUI/src/bin/extensions/SwarmExtensionAhaSwarm/` is missing. After a C# change,
  delete that folder and restart Swarm. Frontend files in `Assets/app/` are read from disk per request (no restart).

## Frontend (`frontend/src`)

| Path | Role |
|---|---|
| `main.ts`, `App.svelte` | Boot (session, params, user settings, presets, current model), top bar, pages. Generate is always mounted; Simple / Utilities / Server / Settings are lazy chunks mounted on first visit, then kept alive. Inside Generate, UI that isn't needed at startup is lazy too, via `lib/util/lazy.ts`: the Presets and Models tabs, the tools (Grid, Batch, Comfy), and the model info, regional prompt and segment modals. The image editor loads its own chunk the first time it opens. Keep new modals, tabs and tools out of the main bundle the same way. |
| `lib/api/` | API layer only, no UI. `client.ts`: session handling (`GetNewSession`, retry on invalid session), `request()` over HTTP, `requestWS()` over WebSocket, `resolveUrl()`. `swarm.ts`: typed wrappers (`api.*`) for every route used, plus `hasPermission`, `outputPrefix`. `types.ts`: response types. `classicPage.ts`: data read from the classic page. |
| `lib/state/` | App state as Svelte 5 rune classes (singletons). `params.svelte.ts` (`paramState`: ListT2IParams, values, toggles, groups, LoRAs, `buildInput`), `gen.svelte.ts` (`gen`: jobs, live progress, batch outputs, current image, status polling, generate forever / previews), `batch.svelte.ts` (batch options), `ui.svelte.ts` (`ui`: page, bottom tab, `mobile` / `portrait` matchMedia flags, mobile panel state, toasts, confirm dialog, cross-page hand-offs like `historyPath` / `historyFilter`), `presets.svelte.ts`, `tools.svelte.ts` (`toolState`: open tool, which tools the user has, the tool run behind the Generate button, Comfy fullscreen), `usersettings.svelte.ts`, `models.ts` (`selectModel`), `metadataModels.ts`, `actions.ts` (shared image/model actions), `promptdock.svelte.ts`. |
| `lib/util/` | Pure helpers: metadata parsing/formatting (`fileMeta.ts` reads a dropped file's metadata, falling back to `stealth.ts` for stealth metadata), model info formatting, browser display formats, Civitai, autocomplete, prompt editing, storage (`ahaswarm.`-prefixed localStorage), swipe gestures (`swipe.ts`) and the browser back/forward guard (`navGestures.ts`). See [mobile.md](mobile.md). |
| `lib/ahakit/` | AhaKit, the UI component library. See [components.md](components.md) and [writing-components.md](writing-components.md). |
| `lib/nav.ts` | Sub-pages of Utilities / Server / Settings (shared by sub-tab bars and the navbar split-tab menus). |
| `components/ui.ts` | The single place the app imports AhaKit from. |
| `components/**` | Pages and composition (generate, params, history, models, presets, browser, simple, utilities, server, settings, layout). Their CSS is layout only. |
| `styles/` | `app.css` and `browser.css` (shared browser display formats: Cards / Thumbnails / List / Details List). |

## Data flow

1. Boot: `newSession()` → `GetNewSession`; then `ListT2IParams`, `AhaGetInstallFeatures` (only with `install_features`), `GetUserSettings`, `GetMyUserData` fill the state classes.
2. Components read state (`paramState`, `gen`, `ui`, ...) reactively and call `api.*` or state methods; components never
   call `fetch` directly.
3. Generation: `gen.generate()` builds the input with `paramState.buildInput()` (plus the current preset stack) and opens
   `GenerateText2ImageWS`. Messages update job slots (`gen_progress`), batch outputs and the current image (`image`), and
   remove discarded outputs (`discard_indices`). `batch_index` 0..n are images, -1 is the grid, <= -10 are intermediates.
4. Status: `GetCurrentStatus` polls every 2s while busy, 60s when idle, and pauses in background tabs.

## Notes and gotchas

Things the code relies on that aren't obvious from reading it.

**C# side**
- The `/Ahadev/` proxy only answers loopback clients: the Vite dev server serves source files (and `/@fs/`). It forwards
  cookies itself (the handler keeps no cookie jar of its own) and drops hop-by-hop headers.
- `aha-login.js` hooks classic `loginpage.js`'s `sendJsonToServer('API/Login', …)`: on success it goes to `Aha/` before
  classic's own redirect. The "Log in to AhaSwarm" choice is remembered per browser (localStorage).
- `Assets/app/` hashed assets are cached forever; `index.html`, `sw.js` and `manifest.webmanifest` always revalidate.

**State**
- The url hash follows classic's format, `#<bottom tab>,<top tab>[,<sub tab>]` with classic's tab hrefs (`ui.hash()`,
  `applyHash()`; sub-tab hashes live in `lib/nav.ts`), so classic links open the same tab. Older `#server`-style hashes still work.
- Large server data (`paramState.raw`, generation outputs) is replaced as a whole, never mutated, so Svelte doesn't
  build deep proxies over hundreds of params, model lists or data-URL images.
- Params are persisted debounced; media params (base64 data URLs) never are. The memory expires after the user setting
  `parametermemorydurationhours`, like classic's `lastparam_` cookies (only group open/closed state survives).
- Generate Previews runs only replace the current image; their data-URL images never go into the batch.
- A generation message without an image path never becomes the current image.
- `PARAMETER_REMAPS` in `params.svelte.ts` is a copy of `T2IParamTypes.ParameterRemaps` (not exposed by the API), and the
  aspect-ratio maths must match `T2IParamInput.GetImageWidth`. Keep both in sync with the server.
- Batch options use classic's own localStorage keys, so classic and AhaSwarm (same origin) share them. The Simple tab
  keeps last values per workflow in sessionStorage, cleared on the first visit of a page load (classic `onTabClicked`).
- `paramState.applyComfy` stores the active workflow under classic's `last_comfy_workflow_input` key.

**Mobile**
- At `max-width: 768px`, `ui.mobile` is true and the Generate page uses full-screen Parameters/Output panels, mid-area swipes, and a collapsible bottom drawer instead of the desktop splitters. Panels follow the finger, then snap on fling or a short drag. The drawer keeps the last tab (and at most one previous tab) mounted, and Parameters is prewarmed on idle. Details are in [mobile.md](mobile.md).

**Requests**
- `request` in `client.ts` coalesces overlapping identical reads for the routes in `DEDUPE`. Status polling backs
  off on errors and pauses in a hidden tab. `PromptBox` caches `CountTokens` by prompt, model, and text so a params
  remount does not recount. See [api.md](api.md).

**Classic page scraping**
- A few lists have no API and are rendered server-side into the classic `Text2Image` page (extension tables, API key
  types). `lib/api/classicPage.ts` reads them from that page (same origin and cookies), cached per page load. When
  not signed in or not installed, classic renders only a redirect script.

**Comfy Workflow**
- Graph objects are parsed inside the ComfyUI iframe (`w.JSON.parse`): LiteGraph checks prototypes, so objects from
  the parent window don't load. Newer ComfyUI frontends also need a file name for `loadApiJson`.
- The iframe stays mounted after its first open (switching tools must not reload the graph), so LiteGraph's canvas is
  re-fitted with a `resize` event when the pane is shown or resized.
- Browse → Replace saves under the (possibly edited) name with `replace` = the old name; the server deletes the old
  entry after saving. An empty `image` keeps the saved preview.

## Classic SwarmUI reference

AhaSwarm reimplements the classic UI, so classic's code is the spec. A reference checkout is usually at
`/workspace/SwarmUI-ref` (otherwise clone `mcmonkeyprojects/SwarmUI`). Read the classic code before implementing a
feature, and name the classic function you ported in a comment (e.g. `// classic gotImageResult`).

Where things live in classic:

- Generate page layout, batch gear options: `src/Pages/_Generate/GenerateTab.cshtml`, `src/wwwroot/js/genpage/gentab/layout.js`
- Current image, batch, batch options: `src/wwwroot/js/genpage/gentab/currentimagehandler.js`
- Generation WebSocket handling: `src/wwwroot/js/genpage/helpers/generatehandler.js`
- Generate / forever / previews buttons: `src/wwwroot/js/genpage/gentab/generatecontrols.js`
- Params panel: `src/wwwroot/js/genpage/gentab/params.js`
- Model browsers, edit/rename/delete/raw header, browse history: `src/wwwroot/js/genpage/gentab/models.js`
- Generic browser (formats, filter): `src/wwwroot/js/genpage/helpers/browsers.js`
- Metadata display: `src/wwwroot/js/genpage/helpers/metadatahelpers.js`
- LoRAs, presets: `src/wwwroot/js/genpage/gentab/loras.js`, `presets.js`
- Simple tab: `src/Pages/_Generate/SimpleTab.cshtml`, `src/wwwroot/js/genpage/simpletab.js`
- Utilities, Server, User tabs: `src/Pages/_Generate/UtilitiesTab.cshtml`, `ServerTab.cshtml`, `UserTab.cshtml`; `src/wwwroot/js/genpage/utiltab.js`, `usertab.js`, `server/servertab.js`, `server/backends.js`, `server/logs.js`
- Settings editors: `src/wwwroot/js/genpage/helpers/settings_editor.js`
- Image editor (layers, masks, tools, init image / mask export): `src/wwwroot/js/genpage/helpers/image_editor.js`, `image_editor_tools.js`; `getGenInput` in `gentab/params.js`
- Model edit / rename / delete modals: `src/Pages/_Generate/GenTabModals.cshtml`
- Prompt '+' menu, Auto Segment Refinement and Regional Prompt modals: `src/wwwroot/js/genpage/gentab/prompttools.js` (`PromptPlusButton`), `GenTabModals.cshtml`
- API routes and parameters: `src/WebAPI/*.cs` (`T2IAPI.cs`, `ModelsAPI.cs`, `BasicAPIFeatures.cs`, `AdminAPI.cs`, ...)
- Param definitions: `src/Text2Image/T2IParamTypes.cs`
- Model metadata and file rewrite: `src/Text2Image/T2IModel.cs` (`ResaveModel`), `T2IModelHandler.cs`

Tips: `rg -n "functionName" src/wwwroot/js` finds classic behaviour quickly. API parameter names and defaults are in the
`[API.APIParameter]` attributes of the C# method with the route's name. Classic stores UI options in localStorage
(e.g. `autoClearBatch`); AhaSwarm reuses those keys where sharing the setting makes sense. Output toggles are saved in
the AhaSwarm user file as `settings.output` and mirrored to those classic keys. Output image size and history thumb
size stay in this browser and are left out of that file.

**Classic behaviours matched**

Server → Users matches classic `UserAdminManager`: filter, add / delete / impersonate users, change password (client
prehash), OAuth email, per-user settings, add / edit / delete roles with grouped permission toggles. Two deliberate
differences: the `owner` role and the `local` user are read-only in the UI, since editing either can lock everyone out
of the server. The server itself still allows those edits through the API.

Param groups can show an install button when a ComfyUI feature is missing. Classic is `addInstallButton` plus the three
built-in buttons in `gentab/params.js`, installed through `installFeatureById` / `doFeatureInstaller` /
`ComfyInstallFeatures`. The built-ins are ControlNet preprocessors (`controlnet` / `controlnetpreprocessors` /
`controlnet_preprocessors`, group kept visible), IP Adapter (`imageprompting` / `ipadapter` / `ipadapter`, group not
forced), and frame interpolation (`advancedvideo` / `frameinterps` / `frame_interpolation`, group kept visible). Any
other button comes from `AhaGetInstallFeatures`, which reads each extension's `ScriptFiles` for a real
`addInstallButton(groupId, featureId, installId, label)` call and skips comments. Dynamic Thresholding's script is the
one caller today. The feature id is matched as one whole string against the backend feature set (server features plus
model add/remove flags). The install id may be a comma-separated list, and every id must exist in the catalog or the
button is not shown. A kept-visible group stays in the tree only when the filter is empty and, for an advanced group,
advanced parameters are shown. Confirm shows the feature notice. On success the button stays disabled, status is polled
immediately and again after 8 seconds, and the button is then removed even if the feature flag is not back yet. A
failed install re-enables the button and shows the error. The parameter list is not reloaded. Buttons are hidden
without `install_features` (classic still draws them, and the install API rejects the click) and while the Comfy
workflow editor is open. An install-only togglable group still shows its enable switch; its content stays at full
opacity until the group has parameters.

The ControlNet group has a Preview button, classic `controlnetShowPreview`. It turns the group on and runs one
generation with `controlnetpreviewonly`, `donotsave`, an empty prompt and no batch size. The result stays in the group.
Save to Server stores that image under `inputs/controlnet/` through `AddImageToHistory` (`controlnetSavePreviewToServer`).

Completion sound is classic `playCompletionAudio` (`site.js`). User → User Settings → Audio, `audio.completionsound`
(a file in `Data/Audio`, served at `/Audio/`) plays at `audio.volume` when a GenerateText2Image socket sends
`socket_intention: close` (Generate, previews, and the Simple tab) and when a grid run sends `success`. An interrupted
generation stays quiet unless `ui.removeinterruptedgens` is on. The image batcher does not play it. Each Aha generate
click opens its own socket, so several clicks queued together each play once; classic reuses one socket and plays once
when that socket drains.
