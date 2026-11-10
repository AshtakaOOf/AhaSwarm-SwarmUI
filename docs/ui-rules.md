# UI / UX rules

These come from the project owner. Follow them unless told otherwise.

- **Compact and dense.** Small gaps, one control height, no wasted space. Keep param spacing consistent (the gap between
  params matches the gap between stepper buttons) and section padding consistent.
- **Lucide icons** (`@lucide/svelte`) for every icon. Prefer icon + short label; icon-only where it saves room (with a label).
- **Colours by intent.** Destructive actions are red (`variant="danger"`, `danger: true` in menus). Primary actions use
  the white accent (`variant="primary"`).
- **Every button has a visible surface.** No invisible text buttons; ghost buttons only where an existing pattern uses them.
- **Native `title` tooltips only on icon-only buttons** (and the param-ID hovers in metadata). Not on text buttons, cards or rows.
- **Hover effects only on clickable things.** No hover shadows or highlights on static content.
- **Popups over side panels.** Details, editors and confirmations open in a Modal or Popover, not a tiny panel at the side.
- **Confirm destructive actions** with `ui.ask()` (AhaKit ConfirmDialog), not `window.confirm`, for new code.
- **Async actions give feedback.** Server actions show a pending state and a result toast; AhaKit `Button` does this
  when `onclick` returns a promise.
- **Stable layout.** Cards keep their width when opened, skeletons match the real layout, nothing jumps on load.
- **Parity with classic SwarmUI** in behaviour (see [classic-parity.md](classic-parity.md)), adapted to AhaSwarm's look.
- **Reuse AhaKit, no hacks.** Clean, standard implementations. No magic offsets, `!important` piles, timing hacks or
  duplicated logic. If a component is missing a capability, extend the component.
- Desktop first; narrow screens must still work (param drawer, stacked batch).
