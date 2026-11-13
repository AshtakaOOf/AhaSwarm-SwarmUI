# Classic SwarmUI parity

AhaSwarm reimplements the classic UI, so classic's code is the spec. A reference checkout is usually at
`/workspace/SwarmUI-ref` (otherwise clone `mcmonkeyprojects/SwarmUI`). Read the classic code before implementing a feature,
and name the classic function you ported in a comment (e.g. `// classic gotImageResult`).

| Area | Classic source |
|---|---|
| Generate page layout, batch gear options | `src/Pages/_Generate/GenerateTab.cshtml`, `src/wwwroot/js/genpage/gentab/layout.js` |
| Current image, batch, batch options | `src/wwwroot/js/genpage/gentab/currentimagehandler.js` |
| Generation WebSocket handling | `src/wwwroot/js/genpage/helpers/generatehandler.js` |
| Generate / forever / previews buttons | `src/wwwroot/js/genpage/gentab/generatecontrols.js` |
| Params panel | `src/wwwroot/js/genpage/gentab/params.js` |
| Model browsers, edit/rename/delete/raw header, browse history | `src/wwwroot/js/genpage/gentab/models.js` |
| Generic browser (formats, filter) | `src/wwwroot/js/genpage/helpers/browsers.js` |
| Metadata display | `src/wwwroot/js/genpage/helpers/metadatahelpers.js` |
| LoRAs, presets | `src/wwwroot/js/genpage/gentab/loras.js`, `presets.js` |
| Simple tab | `src/Pages/_Generate/SimpleTab.cshtml`, `src/wwwroot/js/genpage/simpletab.js` |
| Utilities, Server, User tabs | `src/Pages/_Generate/UtilitiesTab.cshtml`, `ServerTab.cshtml`, `UserTab.cshtml`; `src/wwwroot/js/genpage/utiltab.js`, `usertab.js`, `server/servertab.js`, `server/backends.js`, `server/logs.js` |
| Settings editors | `src/wwwroot/js/genpage/helpers/settings_editor.js` |
| Image editor (layers, masks, tools, init image / mask export) | `src/wwwroot/js/genpage/helpers/image_editor.js`, `image_editor_tools.js`; `getGenInput` in `gentab/params.js` |
| Model edit / rename / delete modals | `src/Pages/_Generate/GenTabModals.cshtml` |
| Prompt '+' menu, Auto Segment Refinement and Regional Prompt modals | `src/wwwroot/js/genpage/gentab/prompttools.js` (`PromptPlusButton`), `GenTabModals.cshtml` |
| API routes and parameters | `src/WebAPI/*.cs` (`T2IAPI.cs`, `ModelsAPI.cs`, `BasicAPIFeatures.cs`, `AdminAPI.cs`, ...) |
| Param definitions | `src/Text2Image/T2IParamTypes.cs` |
| Model metadata and file rewrite | `src/Text2Image/T2IModel.cs` (`ResaveModel`), `T2IModelHandler.cs` |

Tips: `rg -n "functionName" src/wwwroot/js` finds classic behaviour quickly. API parameter names and defaults are in the
`[API.APIParameter]` attributes of the C# method with the route's name. Classic stores UI options in localStorage
(e.g. `autoClearBatch`); AhaSwarm reuses those keys where sharing the setting makes sense.

## Feature status (Nov 2026)

About **94%** of the classic SwarmUI frontend (33 of 35 classic tabs / feature areas ported, counted in the table
below; areas are weighted equally, so this is an estimate, not a measure).
Still missing: the User tab's Param Config and Layout Config.
Use the Classic UI button for those.

One row per classic tab or feature area (35 total). ✓ = ported, ✗ = missing.

| Classic area | Status |
|---|---|
| Generate: params panel, prompt box (with autocomplete and the '+' menu's Auto Segment Refinement / Regional Prompt modals), current image and its actions, Output batch, Generate / forever / previews | ✓ (5) |
| Generate browsers: Image History, Presets, Models, VAEs, LoRAs, Embeddings, ControlNets | ✓ (7) |
| Model edit / rename / delete / raw header, metadata view | ✓ (2) |
| Wildcards browser tab | ✓ |
| Image editor (layers, masks, brushes, selection; init image + mask for inpainting) | ✓ |
| Reading metadata from a dropped image: PNG / JPEG / WebP text, then stealth metadata in the pixels (alpha and RGB, plain or gzipped; classic reads alpha only) | ✓ |
| Tools (Tools tab in the bottom bar): Grid Generator, Image Edit Batcher, Comfy Workflow editor (with a fullscreen button in its tool bar) | ✓ (3) |
| Simple tab | ✓ |
| Utilities: Miscellaneous (CLIP tokenization at the bottom), Pickle To Safetensors, LoRA Extractor, Model Downloader | ✓ (4) |
| User: User Settings, API keys | ✓ (2) |
| User: Param Config, Layout Config | ✗ (2) |
| Server: Info (Server Manager, with updates), Backends, Server Configuration (in Settings → Server Settings), Users, Extensions, Logs | ✓ (6) |

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
