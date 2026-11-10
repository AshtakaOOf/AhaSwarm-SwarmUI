# Build, dev and checks

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

1. Copy the repo (without `.git`, `frontend/node_modules`, `bin`, `obj`) to `SwarmUI/src/Extensions/AhaSwarm/`,
   including a built `Assets/app/dev` or `Assets/app/dist`.
2. If C# changed: delete `SwarmUI/src/bin/extensions/SwarmExtensionAhaSwarm/` and restart Swarm
   (it rebuilds the extension on launch; check the log for `AhaSwarm: registering frontend`).
3. Open `http://<swarm>/Aha/`. Frontend-only changes need no restart.

Keep verification proportional: `npm run check` and `npm run build` are the baseline. The owner is usage-sensitive, so only
run browser tests or take screenshots when asked or when a change can't be verified otherwise, and keep screenshots out of the repo.

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
