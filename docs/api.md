# API layer

All server access goes through `frontend/src/lib/api/`. Components and state never call `fetch` on `/API/` themselves.

| File | Role |
|---|---|
| `client.ts` | Framework-free client: server root, URL resolving, session, `request` (HTTP) and `requestWS` (WebSocket), `SwarmApiError` |
| `swarm.ts` | `api` object: one typed wrapper per SwarmUI route the app uses, plus `hasPermission(perm)` |
| `types.ts` | Response shapes: `T2IParam`, `T2IGroup`, `SessionInfo`, `CurrentStatus`, `ModelInfo`, `ListModelsResponse`, `HistoryFile`, `ListImagesResponse`, `Preset`, `UserData`, `BackendInfo`, `GenWSMessage`, ... |
| `classicPage.ts` | `classicDoc()`: fetches classic `Text2Image` HTML for the few lists that have no API (extension tables, API key types) |

## Server root and URLs

The app is served at `<root>/Aha/`, so `swarmRoot` is the path up to `/Aha/` (override with `window.AHASWARM_ROOT`).
Routes are `POST ${swarmRoot}API/<Route>`. Use `resolveUrl(path)` for server file paths such as `View/local/raw/x.png` or
a model preview. It encodes each segment and passes `data:`, `blob:` and `http(s):` URLs through.

## Session

- `newSession()` calls `GetNewSession` once (concurrent callers share the same promise). If login is required, it
  redirects to `<root>/Login`.
- `request` / `requestWS` add `session_id` to every body. On `error_id: 'invalid_session_id'` they get a new
  session and retry, at most 3 times.
- `getSessionInfo()` returns the current `SessionInfo` (user id, permissions, output append, ...). `onSession(cb)` runs
  `cb` now if there is a session, and on every new one.
- `hasPermission('edit_model_metadata')` checks `SessionInfo.permissions`. Gate admin and destructive UI with it, as
  classic does (permission ids are in SwarmUI `src/Accounts/Permissions.cs`).

## HTTP: `request<T>(route, body)`

```ts
const res = await request<ListModelsResponse>('ListModels', { path, depth, subtype, sortBy, sortReverse });
```

Resolves with the JSON body. Throws `SwarmApiError(message, errorId, data)` when the reply has `error`, or when the
reply is not JSON (HTTP error page). Swarm returns `{ success: true }` for most write routes.

## WebSocket: `requestWS(route, body, onMessage)`

Opens `ws(s)://.../API/<Route>`, sends the body with the session once open, and passes each parsed message to
`onMessage`. It returns `{ socket, close(), done }`. `done` resolves on a normal close and rejects with
`SwarmApiError` on an `error` message or a connection failure. Used for `GenerateText2ImageWS` (`gen.svelte.ts`),
`DoModelDownloadWS` and `DoLoraExtractionWS`.

## Message shapes and permissions

- A finished image arrives flat (`{ image: "View/...", batch_index, request_id, metadata }`, as T2IAPI sends it and
  classic `generatehandler.js` reads it), not nested as the API docs show. `normalizeGenMessage` turns both into
  `m.image = {...}`. Grid Generator and Image Edit Batcher stream the same messages, ending with `{ success: "complete" }`.
- `ComfyGetGeneratedWorkflow` takes the generate input itself as its body (classic `getGenInput()`).
- `hasPermission(perm)` follows the server's `User.HasPermission`: `*` (owner / full control) grants everything.

## Error handling

Wrap calls in `try/catch` at the UI action and report the failure with `ui.error(e)` (an error toast with the message).
Use `ui.toast(msg, 'success')` for completed actions where classic gives feedback. Do not swallow errors silently. For
loads that can race (folder changes, re-sorts), use a sequence counter and drop stale replies (see `HistoryPage.svelte`
`loadSeq`).

## Calling or adding an endpoint

1. Find the route in SwarmUI: `src/WebAPI/*.cs` (e.g. `ModelsAPI.cs`, `T2IAPI.cs`, `BackendAPI.cs`, `AdminAPI.cs`,
   `UtilAPI.cs`, `BasicAPIFeatures.cs`). Parameter names in the C# signature are the JSON keys (case-sensitive).
   `docs/APIRoutes/*.md` in the SwarmUI repo documents most routes.
2. Check how classic calls it (`src/wwwroot/js/**`, search `genericRequest('<Route>'`) and send the same fields.
3. Add a wrapper to `api` in `swarm.ts` with typed arguments, and a response type in `types.ts` if the result is used.
4. Call `api.x(...)` from state (`lib/state/*`) or the component action, never `request(...)` directly.

## Extension C# side

The C# extension (`AhaSwarm.cs`) serves the built app at `/Aha/`, proxies `/Ahadev/` to the Vite dev server, and adds
the classic tab link. Everything else uses core SwarmUI routes, as classic does, except `AhaSettingsAPI.cs`:
`AhaGetSettings` (`read_user_settings`, returns `{ settings }`, null until first saved) and `AhaSaveSettings`
(`edit_user_settings`, `settings` = JSON object string, max 256 KiB), which store `ui.settings` per user in
`(SwarmUI Data)/AhaSwarm/users/<user id>.json` (atomic write, per-user lock; ids that aren't plain `[a-z0-9_-]` names
get a hash). Nothing is written to SwarmUI's own user data, so disabling the extension leaves classic untouched. If the server needs to do something else core cannot, add a thin `API.RegisterAPICall` the same way
(`Aha*API.cs` registered from `OnInit`, with a permission) and wrap it in `swarm.ts`. Prefer matching classic first.

## SwarmUI routes used by the app

- Session/user: `GetNewSession` (client), `GetMyUserData`, `GetUserSettings`, `ChangeUserSettings`, `SetParamEdits`,
  `SetStarredModels`, `GetAPIKeyStatus`, `SetAPIKey`, `Logout`
- Params and generation: `ListT2IParams`, `GenerateText2ImageWS`, `GetCurrentStatus`, `InterruptAll`, `CountTokens`,
  `TokenizeInDetail`
- Models: `ListModels`, `DescribeModel`, `ListLoadedModels`, `SelectModel`, `EditModelMetadata`, `RenameModel`,
  `DeleteModel`, `GetModelHeaders`, `GetModelHash`, `TriggerRefresh`, `SetPresetLinks`, `DoModelDownloadWS`,
  `ForwardMetadataRequest`, `ForwardImageRequest`
- Images/history: `ListImages`, `DeleteImage`, `ToggleImageStarred`, `OpenImageFolder`
- Presets: `AddNewPreset`, `DeletePreset`
- ComfyUI workflows (Simple tab): `ComfyListWorkflows`, `ComfyReadWorkflow`
- Utilities: `Pickle2SafeTensor`, `WipeMetadata`, `DoLoraExtractionWS`
- Backends: `ListBackends`, `ListBackendTypes`, `AddNewBackend`, `EditBackend`, `DeleteBackend`, `ToggleBackend`,
  `RestartBackends`, `FreeBackendMemory`
- Server/admin: `GetServerResourceInfo`, `ListServerSettings`, `ChangeServerSettings`, `ListLogTypes`,
  `ListRecentLogMessages`, `ListConnectedUsers`, `CheckForUpdates`, `UpdateAndRestart`, `ShutdownServer`,
  `InstallExtension`, `UpdateExtension`, `UninstallExtension`, `SetExtensionEnabled`, `AdminListUsers`,
  `AdminAddUser`, `AdminDeleteUser`, `AdminGetUserInfo`, `AdminListRoles`
