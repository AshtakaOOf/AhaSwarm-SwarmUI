# Build, dev and checks

Outside the UI rules in [ui-rules.md](ui-rules.md), this file describes the owner's own setup and habits. It's shared so agents always have a path that works; other developers aren't bound by it and can verify, test and work however suits them.

Requires Node.js 18+. All commands run in `frontend/`.

```bash
npm ci            # once
npm run check     # svelte-check + TypeScript: must report 0 errors and 0 warnings
npm run build     # writes ../Assets/app/dev (modern + legacy bundle, gitignored)
npm run build:dist  # writes ../Assets/app/dist (the GitHub Action runs this; don't commit it by hand)
npm run dev       # Vite on :5173, open http://localhost:5173/Ahadev/
The `/Ahadev/` proxy in SwarmUI only answers loopback clients (it would expose the dev server and source files); develop remotely through an SSH port forward or tunnel.
```

`npm run dev` proxies `/API` (with websockets), `/View`, `/Output`, `/ViewSpecial`, `/Text2Image` (the classic page the Extensions tab and API key types are read from), `/Login`, `/imgs`, `/Audio` and `/ExtensionFile` to `SWARM_URL` (default `http://127.0.0.1:7801`).

## Testing against a SwarmUI install

1. Build (`npm run build`, writes `Assets/app/dev`), then copy the repo into `SwarmUI/src/Extensions/AhaSwarm/` without
   `.git`, `frontend/node_modules`, `bin`, `obj` and screenshots. Replace the folder rather than copying over it, so
   deleted files don't linger:

   ```bash
   D=SwarmUI/src/Extensions/AhaSwarm
   rm -rf "$D" && mkdir -p "$D"
   tar --exclude=.git --exclude=frontend/node_modules --exclude=bin --exclude=obj --exclude=screenshots -cf - . | tar -xf - -C "$D"
   ```

2. Start Swarm with its dev launch script (`launch-windows-dev.ps1` or `launch-linux-dev.sh`). It rebuilds SwarmUI,
   extensions included, on every launch, so C# changes always run. The normal launchers only rebuild an extension whose
   build folder is missing: with those, delete `src/bin/extensions/SwarmExtensionAhaSwarm/` and
   `src/obj/extensions/SwarmExtensionAhaSwarm/` after any `.cs` change. Frontend-only changes need no restart.
3. Pass `--aha_build dev` to the launch script to be sure it serves your local build and not the committed `dist` one.
4. Quick checks:
   - The log shows `AhaSwarm: registering frontend` and `AhaSwarm: serving the dev build (...)`, and no compile errors
     for the extension.
   - `curl -s http://127.0.0.1:7801/Aha/ | grep aha-build-time` shows the time of the build you just made.
   - API calls can be tried with curl: get a session with
     `curl -s -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:7801/API/GetNewSession`, then post
     `{"session_id": "...", ...}` to `/API/<Route>`. The `Content-Type` header is required.
   - Open `http://<swarm>/Aha/` for anything visual.

Keep verification proportional: `npm run check` and `npm run build` are the baseline for everyone. How you verify beyond
that is your own call. For the owner's own workflow: they are usage-sensitive, so browser tests and screenshots only when
asked or when a change can't be verified otherwise. Either way, never commit screenshots to the repo.

## Comments

Write as few comments as possible. Good names and small functions come first; a comment is the last resort.

- Only comment the non-obvious *why*: a browser quirk, a SwarmUI/classic behaviour you're matching, a workaround,
  an ordering or timing gotcha. Never restate what the code does.
- One short line, usually lowercase, no trailing period: `// chromium: single-line inputs are scroll containers`.
- No section dividers, banners, headings, or commented-out code. No CSS comments that just label a block.
- C#: no `/// <summary>` on obvious members; keep it to one line when an API member needs one.
- Port of a classic function: a short `// classic <functionName>` reference is fine.
- Anything longer than a line (design notes, why a system works the way it does) goes in `docs/`, not in the code.
- Keep tool directives (`svelte-ignore`, `@ts-expect-error`, `@vite-ignore`) and license/attribution headers as they are.
- When you change code, update or delete its comment; a stale comment is worse than none.
