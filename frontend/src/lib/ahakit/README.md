# AhaKit

AhaKit is the AhaSwarm UI component library (`src/lib/ahakit`, imported as `$ahakit`; the app goes through `src/components/ui.ts`).

Svelte 5 + TS components on one theme: `theme.css` (Tailwind 4 `@import "tailwindcss"`, the `@theme` colours/radii, base
layer, `.ctl` / `.chip` / `.kbd` / `.card` / `.shim` / `.pop` / `anim-*`), and the components share its Tailwind class patterns
(Dropdown, GalleryCard / ListRow, Modal / EmptyState / Drawer). `tokens.css` only aliases older token names onto that theme. Icons are `@lucide/svelte` components.

Scale (enforced by `/workspace/sizing/sizing-test.cjs`): three text sizes `text-small` 12 / `text-ui` 13 / `text-body` 14,
one control height `h-8` (32px, `--spacing-ctl`) for app chrome, one dense height (24px, `--spacing-ctl-dense`) for everything
inside a `.ui-dense` scope (the parameter panel; touch pointers keep 32px), one icon size 15px (NumberInput's ▲/▼ glyphs are 12px
in their half-height buttons). Generate is a normal 32px primary split button in the model bar; `size="hero"`
(`--spacing-hero`, 56px) still exists but is unused. Collapsible horizontal Splitters get a Migu-style edge toggle
(`.ui-edge-toggle`: bare stacked-path chevron outside the pane edge, 28x44 / 44x44 on touch; excluded from the sizing count). It hides (`display: none`) while it would cover a clickable element smaller than 3x its size each way (hit test of its box on resize, scroll, load and pointer-follow; no animation loop).
Textareas grow in whole 19px lines from the control height of their scope.

Accent: white with black text (`--color-accent` #fff, `-hover` #e5e5e5, `-active` #d4d4d4, `--color-on-accent` #000, focus
ring `--color-ring` white). Used by primary buttons (Generate), selected tabs, `aria-pressed` controls, checked toggles,
slider fill/thumb. Not used for location/selection: the selected Tree row uses the selected-item look
(bg-active + text-ink, as in a Dropdown option / pressed chip). ParamGroup is a section heading
(muted uppercase small label, no surface) with the Dropdown's ChevronDown and the library Toggle. Disabled `.ctl` keeps its surface and dims
its contents. Focus on an accent surface = white outline + black inset ring.
NumberInput steppers are a vertical ▲ over ▼ column on the right edge, each half the input height.
Value callbacks receive the new value. All components accept `title` for native tooltips.

| Component | Props | Events |
|---|---|---|
| Button | `variant` default/primary/danger/ghost, `size` md (`sm` = md) / `hero`, `block`, `icon` (Lucide component, leading), `iconOnly`, `loading` (spinner + disabled), `done` (success toast), any `<button>` attr | `onclick`: if it returns a promise the button shows a spinner and is disabled until it settles; a rejection shows an error toast (IconButton too) |
| IconButton | `label` (aria-label + tooltip), `icon` (Lucide component) or children, `variant` (ghost), `pressed` - `ctl w-8 px-0` | `onclick` |
| Icon | `icon` (Lucide component) at the one 15px size, `title`, `strokeWidth`, `class` | |
| Field | `label`, `info` (InfoButton next to the label), `hint`, `title`, `forId`, `scrub(e)` (label becomes a horizontal drag handle), `onreset` (label double-click), children (used internally) | |
| TextInput | `bind:value`, `label`, `hint`, `invalid`, `type`, any `<input>` attr | `oninput(v)`, `onchange(v)` |
| Textarea | `bind:value`, `label`, `hint`, `rows` (2), `autosize` (true), `maxRows` (12), `mono` (monospace, for prompts/JSON) | `oninput(v)`, `onchange(v)`, `onsubmit(v)` on Ctrl/Cmd+Enter |
| Slider | `bind:value`, `info` (InfoButton next to the label), `min` `max` (typed limits), `viewMin` `viewMax` (track range; typed values outside it are kept, thumb pins to the end), `scale` linear/pot (log2 track like SwarmUI pot_slider; needs view ≥1), `step`, `defaultValue` (double-click track or label resets), `steppers` (true), `label`, `hint`, `disabled`, `number` (true; false = track only), `buffered` (0-100 %, lighter band after the value, `--color-track-buffered`), `ariaLabel`, `valueText` - range + NumberInput synced | `oninput(v)`, `onchange(v)` |
| NumberInput | `bind:value`, `min` `max` `step`, `wheel` (only while focused), `label`, `ariaLabel`, `hint`, `placeholder`, `size` xs/sm/md, `disabled`, `defaultValue`, `steppers` (true: −/+ buttons; hold repeats and speeds up, Shift ×10, disabled at limits, right-click resets; chevrons on desktop, wide −/+ on touch), `scrub` (drag the label, 4px per step; double-click label resets) - no native spinners; ↑/↓ step, Shift or PgUp/PgDn ×10, Home/End min/max, Enter/blur clamps + snaps, Esc reverts | `oninput(v)`, `onchange(v)` |
| Dropdown (= Select) | `options: {value,label,title?,disabled?}[]`, `bind:value`, `placeholder`, `label`, `ariaLabel` (accessible name with no visible label), `size`, `disabled`, `searchable` (auto when >10 options: filter box, type to narrow, Enter picks) - listbox portaled to body, flips/clamps to viewport; arrows, Home/End, PgUp/PgDn, type-ahead, Enter/Space, Esc | `onchange(v, option)` |
| Toggle | `bind:checked`, `label`, `hideLabel`, `size`, `disabled` (role=switch) | `onchange(checked)` |
| SwitchRow | `label`, `description` (muted second line) or `info` (help text behind an InfoButton), `bind:checked`, `disabled` - settings row with the Toggle at the far right | `onchange(checked)` |
| VirtualGrid | `items`, `key`, `columns` (n / `{min}` / `{width}`), `rowHeight`, `gap`, `colGap`, `overscan` (screens), `class`, `label`, `scroller`, `item` snippet - windowed grid/list, only visible rows mounted | - |
| LoadMore | `remaining`, `auto` (infinite scroll sentinel instead of the button), `label`, `margin` - end of an incrementally rendered list | `onmore()` |
| InfoButton | `label`, `text` (lines split on `\n`) or children, `title`, `placement`, `bind:open` - the params-panel info icon that opens a Popover with help text | - |
| ParamGroup | `title`, `description` (tooltip), `bind:open` (true), `toggleable`, `bind:enabled`, `actions` snippet, children | `ontoggle(open)`, `onenable(enabled)` |
| Tabs | `tabs: {id,label,icon?,title?,disabled?}[]`, `bind:value`, `label`, `menus` (Record<tabId, MenuItem[]>: those tabs become tab-variant SplitButtons), `panel` snippet `(id)` - arrows/Home/End, `menus` (Record<tabId, MenuItem[]>: those tabs render as tab-variant SplitButtons) | `onchange(id)` |
| Modal | `bind:open`, `title`, `size` sm/md/lg/`xl` (viewport-filling, body unpadded), `tone` raised/panel/`clear` (transparent panel), `sheet` (`'auto'` = bottom sheet ≤640px, `true` always), `fullscreen` (`true` always, `'auto'` ≤640px: edge-to-edge, no radius), `side` left/right (drawer), `dismissable`, children, `footer` snippet - focus trap, Esc, backdrop click, focus restore; panel is `.ui-raised` | `onclose()` |
| Drawer | Modal props, `side` right (default)/left; full-height panel `--size-drawer` wide | `onclose()` |
| BottomSheet | Modal props with `sheet` forced on | `onclose()` |
| ToastContainer | `anchor` (CSS selector; stack sits 8px above the first match that is visible and on top, right edges aligned, newest closest; phones <480px: full width minus 8px margins); `position` fallback when no anchor is visible, default bottom-right. Slides in from the right (20px, 200ms), closes with a 150ms fade; no motion under prefers-reduced-motion. Hover pauses auto-dismiss | |
| toasts (module) | `toast(msg, {kind, title, timeout, action})` → id, `toastSuccess/Warning/Error`, `dismiss(id)`, `pause/resume(id)`, reactive `toasts` array. Default timeout 6000ms, errors 0 (stay until closed). Same kind+title+message while shown dedupes (count ×N, timer restarts). `action: {label, href? \| onclick?}` renders an underlined link. Errors use role=alert/aria-live assertive, others status/polite | |
| ProgressBar | `value` (null = indeterminate), `max` (1), `label`, `hideLabel`, `ariaLabel` (falls back to label, then title), `showValue` | |
| FitTitle | `text`, `width` (px, 0 = clean only), `lines`, `sizes`, `clean` - cleaned name, balanced lines with break points, smaller font then a middle cut when long (fitTitle.ts: `cleanTitle`, `breakParts`, `fitTitle`, `middleEllipsis`) | - |
| GalleryCard | `cache` (blob cache, see imageCache.ts), `src` (empty = skeleton only), `alt`, `title`, `caption`, `selected`, `aspect` ('1 / 1'), `fit` cover/contain, `eager`, `video` (muted looping video; `autoplay` plays or pauses it), `live` (src updates in place, no fade per frame), `busy` (spinner over the media), `badge` (small label over the media instead of a caption bar), `ratio` (aspect="auto": the box ratio until the media reports its own, e.g. the requested size of an image still generating), `rowHeight` (row layout: fixed height, width from the media's aspect ratio, with `aspect="auto"`), `placeholder` (text shown with an image icon when `src` is empty, instead of the skeleton; the text hides in small boxes), `overlay` snippet - lazy img, skeleton wave, error icon | `onclick` (makes it a button), `oncontextmenu` |
| Chip | `label`, `variant` default/active/include/exclude/danger, `bind:weight` (shows a wheel-enabled weight box when defined), `min` `max` `step` (−10/10/0.05), `size` md/lg (32/36px), `maxChars` (label truncates past it), `media` snippet (flush thumbnail inside the clickable label), `removeLabel`, `disabled`, children | `onclick` (makes label a button), `onremove()`, `onweightchange(w)` |
| Badge | `label` or children, `tone` neutral/info/success/warning/danger, `title` | |
| StatusDot | `status` idle/queued/running/success/warning/error/offline, `label`, `showLabel` (else screen-reader text + tooltip); long labels ellipsize in a narrow parent | |
| Toolbar | `label` (required), `orientation`, `wrap` (true; false = one row that scrolls sideways), children - role=toolbar, one tab stop, arrows/Home/End roving | |
| ButtonGroup | `label`, `toolbar` (adds roving + role=toolbar), children - joined buttons | |
| SplitButton | main Button + 24px chevron half joined by ButtonGroup; the chevron opens a Menu (all Menu behaviour: anchoring/flip, keyboard, Esc, outside click). `items`, `menuLabel`, `variant` primary (Generate) / default / tab (navbar split tabs: ghost, `selected` = white accent + black text), `contextMenu` (right-click main half opens the menu at the pointer), `block`, `icon`, `bind:open`; other attributes (onclick, role, aria-*, disabled…) go to the main half | |
| Section | `title`, `icon`, `plain` (keep title case), `dense`, `actions` snippet, children - static section card with the ParamGroup surface/rhythm (layout.css `.aha-sec`) | |
| FormRow | `label`, `icon`, `info` (InfoButton text after the label), children - label column + control (`.aha-frow`; wraps when narrow) | |
| Stats | `items: {icon?,label,value}[]`, `label` - icon stat rows in an auto-fill grid; zero values muted | |
| StatusText | `tone` idle/ok/warn/err/busy, `text` - one announced status line with a tone icon (spinner when busy) | |
| ProgressPair | `overall`, `current` (0..1), `label` - classic overall + current-step bars | |
| TaskCard | `title`, `icon`, `image`, `progress {overall,current}`, `state` run/ok/err/cancel, `status`, `actions` snippet, children - long-running task card | |
| SegmentedControl | `options {value,label,icon?}[]`, `bind:value`, `label` - joined buttons, selected = white accent | `onchange(v)` |
| ConfirmDialog | `title`, `message`, `confirmLabel`, `cancelLabel`, `danger` - Modal with Cancel + confirm; render while pending | `onresult(ok)` |
| ListRow | `title`, `meta`, `thumb` (src; `''` = placeholder icon), `thumbAlt`, `progress` (number/null), `selected`, `tooltip`, `leading`/`actions`/children snippets | `onclick` (whole row) |
| QueueItem | `title`, `meta`, `thumb`, `status`, `progress`, `selected`, `dot` (true; false hides the status dot), `actions` snippet - ListRow + StatusDot + danger cancel button while queued/running | `onclick`, `oncancel()` |
| KeyValueList | `items` (`{key,value,title?,mono?,copy?,chips?}[]` or a record), `dense`, `inline` (one-line values that ellipsize; never stacks), `label` - `<dl>`; null shows -; keys ellipsize at 18ch, stacks key over value when narrower than 220px (container query) | |
| EmptyState | `title`, `message`, `icon`, children (one action) | |
| Skeleton | `width`, `height`, `radius`, `lines`, `circle`, `fill` (absolute cover), `label` - the wave used by GalleryCard/ListRow | |
| FileInput (= Dropzone) | `accept`, `multiple`, `disabled`, `label`, `hint`, `title`, `compact`, children - click/Enter/Space browse, drag-drop, filters by accept | `onfiles(files)` |
| ImageInput | `src`, `label` - square image target: preview or upload prompt, click/drop to replace, x to clear | `onfiles(files)`, `onclear()` |
| CopyChip | `value`, `label`, `class` - chip with a clipboard icon that copies its value (trigger phrases, KeyValueList copy rows) | `oncopy(value)` |
| ColorSwatches | `bind:value`, `options {value,label,color?}`, `label`, `custom`, `recent` (a remembered custom colour shown as its own swatch) - swatch radio group + custom colour well; `setAccent`/`accentTokens` apply an accent; the applied theme's palette is `themeAccentOptions()` | `onchange(v)` |
| SettingsSearch | `bind:value` or `scope` (SearchScope), `count`, `placeholder`, `label` - search box for settings pages, "N matches" | - |
| SearchGroup / SearchItem | `title` / `text` - searchable section (`children(searching)`) and item for markup pages, via `provideSearch(new SearchScope())`; `matchesQuery(q, ...texts)` for data-driven ones (search.svelte.ts) | - |
| CopyButton | `text` (string or fn), `label`, `size` - shows "Copied" 1.6s | |
| CodeBlock | `code`, `language`, `wrap`, `copy` (true), `maxHeight` | |
| LogViewer | `lines` or `text`, `bind:autoscroll` (turns off when you scroll up), `wrap`, `height` (240px), `label` - role=log + copy | |
| Breadcrumb | `items: {label, href?, title?}[]`, `label` - last item is aria-current | `onnavigate(item, i)` |
| Splitter | `dragFloor` (px floor for the live drag of a collapsible pane), `direction` horizontal (side by side)/vertical, `bind:size`, `bind:collapsed`, `min`, `max`, `defaultSize`, `unit` px/%, `step` (16px / 2%), `reverse` (size belongs to the second pane, e.g. right or bottom panel), `collapsible`, `persistKey` (localStorage `ui-split:<key>`), `label`, `first`/`second` snippets - nest for the classic left · image · right + bottom prompt layout | `onresize(size)`, `oncollapse(c)` |
| SplitHandle | same sizing props without panes; place between two flex children and bind `size` yourself - role=separator with aria-valuenow/min/max; pointer drag with capture (mouse/touch/pen), arrows step (Shift ×5), Home/End, Enter collapses, double-click resets to `defaultSize`; dragging below min/2 collapses when `collapsible`. 4px handle, 10px hit area (24px on touch) | `onresize`, `oncollapse` |
| Menu | `items: MenuItem[]` (`{id?,label,icon?,shortcut?,title?,disabled?,danger?,checked?,separator?,items?,onselect?}`), `bind:open`, `label`, `trigger` snippet `(props)` - spread `props` on your button (`{...p}`; adds aria-haspopup/expanded, click + ArrowDown/Up opens). role=menu, focus moves into items; arrows/Home/End, type-ahead, Enter/Space, ArrowRight/Left for submenus (`items`, open on hover too), Esc closes one level, Tab/outside click/select close all and focus returns to the trigger. `checked` makes a menuitemcheckbox; `separator` is spacing only (no line). Anchored under the trigger, flips up, submenus open right (left if no room) | `onselect(item)` (after the item's own `onselect`) |
| ImageGrid | `items: {id?,src,alt?,title?,caption?}[]`, `bind:selected` (id or index), `minSize` px (160), `aspect`, `label`, `item` snippet `(item, i)` | `onselect(item, i)` |

Tokens (dark values, from `themes/dark.css`): surfaces `--color-bg` #161616 → `--color-surface` #1e1e1e → `--color-surface-2`/`--color-button`/`--color-popover` #262626 → `--color-hover` #2f2f2f → `--color-selected`/`--color-button-active` #3a3a3a. Ink `--color-text` #e6e6e6, `--color-text-muted` #a6a6a6, `--color-text-subtle` #9a9a9a (≥4.5:1 on all surfaces up to #262626; kit's #727272 is not used). Meaning: `--color-danger`/`-text`, `--color-success`/`-bg`/`-text`, `--color-warning`, `--color-info`. Spacing `--space-0…6` = 2,4,6,8,10,12,16px; radii sm 2px, md/lg 3px; type `--font-size-xs/label/sm/md/lg` = 11/12/13/14/17px; shadows `--shadow-sm/md/lg` = card hover/menu/popover; focus `--focus-ring` (2px `--color-ring` outline, keyboard only, drawn inside via `--focus-offset: -2px`) and `--focus-inset`; text fields show focus by a lighter shade only; motion `--motion-fast/base/menu/wave`. Overlays `--color-backdrop(-strong)`/`--color-scrim`/`--color-overlay(-hover)`/`--color-veil`/`--color-halo`; status text `--color-ok-text`/`--color-warn-text`/`--color-err-text`, `--color-link`; extra shadows `--shadow-float(-strong)`/`--shadow-up`/`--shadow-panel`/`--shadow-media`. Components use no raw hex/rgb, only tokens. Themes: one file per theme in `themes/` (`dark.css`, `light.css`, `catppuccin-mocha.css`, ...), each a `:root[data-theme=…]` block listing every colour token plus its accent palette (`--accent-swatches`) and a high contrast block; applied with `setTheme(id)` ('dark' default, 'light', 'ctp-latte' / 'ctp-frappe' / 'ctp-macchiato' / 'ctp-mocha'), registered in `themes/index.ts` (`THEMES`: id, label, isLight, file); high contrast is `setContrast(bool)` or `applyContrastMode('auto' | 'on' | 'off')` (Auto follows the system's prefers-contrast / forced-colors live; forced colours are handled in `forced-colors.css` and the components) (`data-contrast="high"`, `themes/high-contrast.css` + each theme's block); `setAccent(hex)` overrides the accent inline (see docs/theming.md).

No borders anywhere (no inset rings either): controls are `--color-control` → `--color-control-hover` → `--color-control-active` (pressed/drag-over); `--color-control-border` is kept but transparent. Inside a raised surface (Modal/Drawer panels, or any element you give `class="ui-raised"`) controls and buttons step up one shade (`--color-control-raised*`) so they don't vanish into the panel.

Density: put `data-density="compact"` on `<html>` (or any container) for desktop compact mode: 24px controls (20px small), `--space-1…6` = 3/4/5/6/8/10px, 12px control text. On touch (`pointer: coarse`) compact is 36px controls (34px small, 32px steppers) with 16px input text; default density on touch is 40px.

Theme: dark is default; `data-theme="light"` (or a Catppuccin flavour) on `<html>` swaps every colour token (AA-checked).

New tokens: `--color-control*`, `--color-info-bg/-text`, `--color-warning-bg/-text`, `--color-danger-bg`, `--color-neutral-bg`, `--size-drawer`, `--size-thumb-row`, `--size-dot`, `--size-split`, `--size-split-hit`, `--color-control-active`, `--color-ring`, `--size-stepper`, `--size-number-steppers`.

Primary buttons are the kit's "strong" shade, not a colour; toggles use the include green when on.

Helpers: `uid`, `clamp`, `snap`, `fitNumber`, `copyText`; types `Option`, `TabItem`, `GalleryItem`, `ButtonVariant`, `Size`, `ToastPosition`, `Tone`, `Status`, `Crumb`, `KeyValue`, `MenuItem`, `MenuTriggerProps`; `placePopover(anchor, pop, side, matchWidth)` (internal, used by Dropdown/Menu).

| Popover | `bind:open`, `title`, `label`, `placement` bottom/top, `autofocus`, `compact`, `flush` (no padding, content edge to edge), `trigger` snippet (gets aria + onclick props), children - `.pop.on` panel, Esc/outside close | `onclose()` |
| Tooltip | `text` or `content` snippet, `placement`, `delay` (500), `touch` longpress/tap/none, `disabled`, children (first child gets aria-describedby) | |
| Suggestions | `anchor` (input/textarea or wrapper), `items: {id?,label,detail?,icon?,disabled?}[]`, `bind:open`, `bind:active`, `caret` (place at caret), `matchWidth` (default true; false sizes the popup to its content), `id`, `label`, `empty`, `item` snippet - owns ↑/↓, Enter/Tab, Esc on the field | `onpick(item, i)`, `onclose()` |
| Tree | `items: TreeItem[]` (`children` or `lazy`), `bind:selected`, `bind:expanded` (ids), `label`, `followFocus`, `loadChildren(item)`, `item` snippet - WAI-ARIA tree keys | `onselect`, `onexpand`, `onactivate` |
| Menu | also `context` + `target` (right-click / long-press opens at the pointer) and `openAt(x, y)` via `bind:this`; `MenuItem.icon` is a Lucide component | |

## Param panel colours

`tokens.css`: `--param-panel-bg` (#1c1c1c, panel + sticky top rows + pinned prompt card) and `--param-section-bg` (#232323, each top-level ParamGroup incl. PROMPT). Inside a section the control surfaces are re-mapped to `--param-ctl` (= `--color-hover`), `--param-ctl-hover` (= `--color-active`) and `--param-ctl-active` so inputs keep contrast; nested groups add no colour of their own.

Page layout classes (`layout.css`): `.aha-page` (inset page column), `.aha-body` (scroller), `.aha-secs` (ParamGroups inside get the section surface), `.aha-acts`, `.aha-form`, `.aha-muted`, `.aha-tbl`.

Theme hooks: selected / pressed controls use `--color-pressed*` / `--color-on-pressed` and `--edge-pressed*` (default: the accent fill), `.ctl-strong` / `.ctl-danger` use `--edge-strong`, and text fields (`.ctl-field`, Textarea, NumberInput) use `--color-field` (unset = control surface) and `--edge-field`. See docs/theming.md.

Status fills (danger buttons, chips, badges, error toast) use `--color-danger-fg` / `--color-success-fg` / `--color-warning-fg` / `--color-info-fg` for text and icons. See docs/theming.md.

ProgressBar `detail`: a value text (e.g. "6.9 / 15.6 GiB") between the label and the percentage on one aligned row; the track is `--color-progress-track` (unset = the control surface where the bar is). Stats `variant="tiles"`: equal tiles, label over a larger value.

CommitList: `lines` (SwarmUI CheckForUpdates `preview` strings, "date: subject", "..." for a skipped middle), `label` - a compact commit timeline (rail, commit icon, subject, date). Server Manager shows one per update target, each with a Toggle to skip it, like classic.

VideoPlayer: `src`, `autoplay` (true), `bind:loop` (true), `bind:muted`, `label` - video with Plyr-style controls built from AhaKit pieces: a bottom bar on `--media-scrim` with IconButtons, a Slider for progress (with the buffered range) and volume, the time, a Menu for speed and loop, and full screen. Controls hide while playing until the pointer moves. The bar follows the shown picture (not the letterbox); hosts can set `--vp-clear-x` / `--vp-clear-b` to keep it clear of their own edge overlays. Keys: Space/K, M, F, arrows. `mediaTime(s)` formats m:ss.

AudioPlayer: `src`, `autoplay`, `label` - audio with a static waveform (SoundCloud style): fetched once, decoded once into peaks, and the same bytes play through a blob URL (no second download). Played part in the accent, the rest `--color-active`; click/drag or arrow keys seek, hover shows the time. Redrawn only on time updates, hover and resize. Cross-origin/undecodable files show a flat line.

Grid: `cols` (2), `min` (320px), `balance`, `label`, `class` - masonry page grid: `cols` independent column stacks (each item right under the one above it, no row alignment), items alternating between columns in order (with `balance`, columns are planned in advance to even out the heights every item would have fully expanded, collapsed sections included, then stay fixed while sections open or close; they are re-planned when the column count changes, items are added or removed, or an item's content changes size a lot; `onplan(firstOfColumn)` gets the indexes of each column's top item after a plan); one column when narrower than cols × `min`. A child with `class="aha-span"` spans the full width. Server Manager uses 2 columns; settings, Backends and the Grid Generator / Image Edit Batcher tools use up to 3 or 2.
