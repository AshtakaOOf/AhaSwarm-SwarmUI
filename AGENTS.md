# AGENTS.md

Guidance for AI coding agents working on AhaSwarm lives in [docs/](docs/README.md):
mainly the AhaKit components (using them and writing new ones) and the API layer, plus UI rules, classic SwarmUI parity,
architecture and the build/check workflow.

Essentials:
- Reuse and extend AhaKit (`frontend/src/lib/ahakit`, imported via `frontend/src/components/ui.ts`); document new components in its README.
- Match classic SwarmUI behaviour; read its source first.
- Compact UI, Lucide icons, red for destructive, accent for primary, no hacky solutions.
- Run `npm run check` (0 errors, 0 warnings) and `npm run build` in `frontend/`.
- `Assets/app/` is build output (gitignored).
