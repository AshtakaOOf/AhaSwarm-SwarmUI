# Writing AhaKit components

AhaKit is the component library in `frontend/src/lib/ahakit/`: one theme, shared control classes and a consistent
component structure. Look in [components.md](components.md) before writing any markup. Anything that could be used
twice goes in AhaKit, not in a page.

## Where things live

- `lib/ahakit/Name.svelte`: one component per file. `index.ts` exports it, and `README.md` has the prop table.
- `lib/ahakit/theme.css` (Tailwind 4 `@theme`, `.ctl`, `.chip`, `.card`, `.shim`, `.pop`), `tokens.css` (token
  aliases), `layout.css` (page classes `.aha-page`, `.aha-secs`, `.aha-sec`, `.aha-frow`, `.aha-acts`, `.aha-muted`,
  `.aha-stats`, `.aha-tbl`).
- `lib/ahakit/types.ts`, `util.ts`, `toasts.svelte.ts`: shared types, helpers and the toast store.
- `components/ui.ts`: the only import point for app code (`import { Button, Modal } from '../ui'`).
- App-specific composites that are not generic (BrowserCard, BrowserSkeleton, ParamSkeleton, ...) live next to their
  feature in `components/<area>/`, and are built from AhaKit parts.

## Template

```svelte
<script lang="ts">
  // One line on what it is and where it is used.
  import type { Snippet } from 'svelte';
  import type { LucideIcon } from '@lucide/svelte';
  import { uid } from './util';
  type Props = {
    label: string;
    description?: string;
    checked?: boolean;
    icon?: LucideIcon;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
    children?: Snippet;
  };
  let { label, description, checked = $bindable(false), icon, disabled = false, onchange, children }: Props = $props();
  const id = uid('row');
  const muted = $derived(disabled || !checked);
</script>
```

- **Svelte 5 runes only:** `$props()` with a typed `Props`, `$bindable()` for two-way values, `$state` / `$derived` for
  local state, `$effect` only for real side effects (DOM, timers, observers), with cleanup returned. Wrap reads you
  must not track in `untrack()` (e.g. initial form state from a prop).
- **Events are callback props** (`onclick`, `onchange(value)`, `onclose()`), not `createEventDispatcher`. Spread
  `...rest` onto the root element when the component wraps a native element (Button does this).
- **Content is snippets:** `children`, and named snippets for slots (`footer`, `actions`, `trigger(props)`, `overlay`).
  A `trigger` snippet receives the ARIA/handler props to spread on the caller's button.
- **Icons:** Lucide via `@lucide/svelte/icons/<name>` in app code, or take a `LucideIcon` prop. Render at 15px
  (`<Icon>`), 14px in section headings.
- **No app imports:** AhaKit must not import `lib/state`, `lib/api` or app components. It takes data as props and
  reports through callbacks.
- **Accessibility:** real `<button>` for actions, roles and `aria-*` on custom widgets, keyboard support for anything
  clickable, ids from `uid()`. A pointer-only shortcut gets a `svelte-ignore` comment with the reason.

## Styling

- Use the theme classes and tokens: `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--text-*)`,
  `var(--size-control)`. No hard-coded colours.
- Scale: text 12 / 13 / 14 (`text-small` / `text-ui` / `text-body`). Controls are 32px (`h-8`), 24px inside `.ui-dense`
  (param panel). Icons 15px.
- Controls use `.ctl` and its variants (`ctl-strong` accent primary, `ctl-danger` red destructive, `ctl-ghost`). Every
  button keeps a visible surface.
- Accent is white with black text (`--color-accent` / `--color-on-accent`). The param panel is `#1c1c1c`, sections
  `#232323`.
- Scoped `<style>` covers the component's own layout. App components style layout only (spacing, grid, sizing). Colours,
  surfaces, radii and states come from AhaKit.
- Hover shadows and lift only on clickable things. Tooltips only on icon-only buttons (IconButton's `label`).

## Adding one

1. Create `lib/ahakit/Name.svelte` from the template.
2. Export it from `lib/ahakit/index.ts` (`export { default as Name } from './Name.svelte';`, and any types).
3. Re-export it from `components/ui.ts`.
4. Add a row to `lib/ahakit/README.md` (purpose, props, events) and an entry to [components.md](components.md).
5. Replace the one-off markup that prompted it, and run `npm run check`.

When you change props, update both READMEs in the same commit.
