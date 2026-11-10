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
| Model edit / rename / delete modals | `src/Pages/_Generate/GenTabModals.cshtml` |
| Prompt '+' menu, Auto Segment Refinement and Regional Prompt modals | `src/wwwroot/js/genpage/gentab/prompttools.js` (`PromptPlusButton`), `GenTabModals.cshtml` |
| API routes and parameters | `src/WebAPI/*.cs` (`T2IAPI.cs`, `ModelsAPI.cs`, `BasicAPIFeatures.cs`, `AdminAPI.cs`, ...) |
| Param definitions | `src/Text2Image/T2IParamTypes.cs` |
| Model metadata and file rewrite | `src/Text2Image/T2IModel.cs` (`ResaveModel`), `T2IModelHandler.cs` |

Tips: `rg -n "functionName" src/wwwroot/js` finds classic behaviour quickly. API parameter names and defaults are in the
`[API.APIParameter]` attributes of the C# method with the route's name. Classic stores UI options in localStorage
(e.g. `autoClearBatch`); AhaSwarm reuses those keys where sharing the setting makes sense.

## Feature status (Nov 2026)

About **91%** of the classic SwarmUI frontend (32 of 35 classic tabs / feature areas ported, counted in the table
below; areas are weighted equally, so this is an estimate, not a measure).
Still missing: the image editor (inpainting / masks) and the User tab's Param Config and Layout Config.
Use the Classic UI button for those.

One row per classic tab or feature area (35 total). ✓ = ported, ✗ = missing.

| Classic area | Status |
|---|---|
| Generate: params panel, prompt box (with autocomplete and the '+' menu's Auto Segment Refinement / Regional Prompt modals), current image and its actions, Output batch, Generate / forever / previews | ✓ (5) |
| Generate browsers: Image History, Presets, Models, VAEs, LoRAs, Embeddings, ControlNets | ✓ (7) |
| Model edit / rename / delete / raw header, metadata view | ✓ (2) |
| Wildcards browser tab | ✓ |
| Image editor (inpainting / masks; the menu entry is disabled) | ✗ |
| Tools (Tools tab in the bottom bar): Grid Generator, Image Edit Batcher, Comfy Workflow editor (with a fullscreen button in its tool bar) | ✓ (3) |
| Simple tab | ✓ |
| Utilities: Info, CLIP Tokenization, Pickle To Safetensors, LoRA Extractor, Model Downloader | ✓ (5) |
| User: User Settings, API keys | ✓ (2) |
| User: Param Config, Layout Config | ✗ (2) |
| Server: Info (with updates), Backends, Server Configuration, Users, Extensions, Logs | ✓ (6) |
