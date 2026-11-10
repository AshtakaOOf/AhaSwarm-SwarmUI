# Build, dev and checks

Requires Node.js 18+. All commands run in `frontend/`.

```bash
npm ci            # once
npm run check     # svelte-check + TypeScript: must report 0 errors and 0 warnings
npm run build     # writes ../Assets/app (modern + legacy bundle)
npm run dev       # Vite on :5173, open http://localhost:5173/Ahadev/
The `/Ahadev/` proxy in SwarmUI only answers loopback clients (it would expose the dev server and source files); develop remotely through an SSH port forward or tunnel.
```

`npm run dev` proxies `/API` (with websockets), `/View`, `/Output`, `/ViewSpecial`, `/Text2Image` (the classic page the Extensions tab and API key types are read from), `/Login`, `/imgs`, `/Audio` and `/ExtensionFile` to `SWARM_URL` (default `http://127.0.0.1:7801`).

## Testing against a SwarmUI install

1. Copy the repo (without `.git`, `frontend/node_modules`, `bin`, `obj`) to `SwarmUI/src/Extensions/AhaSwarm/`,
   including the built `Assets/app`.
2. If C# changed: delete `SwarmUI/src/bin/extensions/SwarmExtensionAhaSwarm/` and restart Swarm
   (it rebuilds the extension on launch; check the log for `AhaSwarm: registering frontend`).
3. Open `http://<swarm>/Aha/`. Frontend-only changes need no restart.

Keep verification proportional: `npm run check` and `npm run build` are the baseline. The owner is usage-sensitive, so only
run browser tests or take screenshots when asked or when a change can't be verified otherwise, and keep screenshots out of the repo.
