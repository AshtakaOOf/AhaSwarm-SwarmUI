# Mobile layout

The Generate page (and a few shared chrome bits) switch at `max-width: 768px` (`MOBILE_MQ` / `ui.mobile` in `ui.svelte.ts`). Portrait-only tweaks also require `orientation: portrait` (`PORTRAIT_MQ` / `ui.portrait`). Above 768px the desktop splitters are unchanged.

Flags and open-panel state live on `ui` (`paramsOpen`, `batchOpen`, `bottomOpen`). Leaving Generate, or leaving the 768px breakpoint, closes the side panels. `ui.showBottom()` increments `bottomOpenReq`, which the Generate page treats as a request to expand the drawer.

## Top bar

`TopBar.svelte` replaces the page tabs with a back button (`undo-2`, the same icon as image-editor undo) and a hamburger `Menu` of every page, with section headers for Utilities / Server / Settings (no submenus). The menu uses AhaKit `Menu` `dense` (a two-column grid sized to fit most phone screens without scrolling). If Classic UI is not hidden in settings, it is the last item in this menu and is omitted from the bar.

The back button closes, in order, the page menu, the queue popover, the account popover, Parameters, Output, then the bottom drawer. It is disabled when none of those are open; only the icon is muted.

Queue and account still use the desktop `Popover`, with `class="as-modal"` so the panel uses the modal fill (`--color-raised`; OreUI keeps its own modal colour). On mobile they `pin` to the top of the viewport, just under `--app-top`: the queue popover is 65dvh tall and contains backend status, overall generation progress, and the queue list; the account popover is `pinHeight="auto"` (up to 50dvh). If there are more than two API key fields, the rest sit in a collapsed "More keys" group. A thin progress bar still runs along the bottom of the top bar while generating.

`--app-top` is the measured height of the top bar, set on `document.documentElement`.

## Generate page

On mobile, Parameters and Output are not splitters. They are `ScreenPanel`s (`layout/ScreenPanel.svelte`), portaled to `document.body`, full width, from the top bar down to the generate strip (`height: calc(100dvh - var(--app-top) - var(--strip-h))`). Escape closes them. The same `ParamPanel` and `BatchPanel` as desktop are reused (slim param container queries still apply).

A `ScreenPanel` stays mounted after it has been shown: when closed it sits off-screen, `inert`, and does not take pointer events. Parameters is also prewarmed off-screen on idle (`requestIdleCallback`) after arriving on Generate, so the first open does not hitch. Clicking the Output edge control or the Output item in the strip menu slides that panel in from the right, the same side as a swipe.

Chevron buttons on the left and right edges (`EdgeToggle.svelte`, 36% down the area below the top bar) open Parameters and Output. They are hidden while a side panel or the bottom drawer is open, and whenever a current image is shown.

The current-image area (`.mid`) is the swipe surface. The image and its metadata scroll together; action buttons sit above the metadata in one horizontally scrolling row (`ImageActions` `rail`). Overall generation progress is not shown here; it belongs in the queue popover. When no image is selected, the empty state is centered in the image area and includes a short gesture hint.

The full-size image viewer (`FullView.svelte`) keeps its action buttons in a wrapping row (no horizontal scroll) and a square close button.

## Swipes

`lib/util/swipe.ts` is an action for touch and pen only (not mouse). `only: 'x'` or `'y'` claims just that axis. It ignores inputs, the image editor (`.ed`), AhaKit modals (`.ui-modal`), sliders, and `[data-no-swipe]`. A gesture that can still scroll its container is left to native scroll (with 4px slack at the edges). Once a swipe is captured, `preventDefault` runs so the browser does not take over. The trigger distance is 56px after an 8px axis lock. Horizontal swipes that start in the 32px screen edges also call `preventDefault` immediately, so they are not treated as browser back/forward. Vertical scrolling in History and other lists still works when a swipe starts near an edge.

Panels follow the finger while dragging, then snap. A fling (velocity of at least 0.3) or a drag of at least 40px or 15% of the travel (whichever is smaller) opens or closes in the direction of the move; a shorter drag snaps back. The bottom drawer rubber-bands past its ends. Parameters and Output use the same open/close rule as the drawer.

On the current-image area (`.mid`, `touch-action: pan-x pan-y`):

- right opens Parameters, left opens Output, up opens the bottom drawer
- down closes the bottom drawer if it is open

The drawer can also be opened or closed from the generate strip, the drag bar, or the drawer header. If Parameters or Output is open, a vertical drag on the strip or handle closes that panel first (back to the current image) and then runs the usual drawer swipe.

On an open Parameters panel, a left swipe closes it; on Output, a right swipe. A downward swipe on the open bottom drawer closes it. That drawer listener only claims the vertical axis (`only: 'y'`), so a horizontal swipe inside History or Models is left for the folder tree.

Only one of Parameters, Output, and the bottom drawer is open at a time (`closeOthers` in `GeneratePage.svelte`). Rotating the phone does not close the drawer.

## Bottom drawer

The bottom region stays a vertical `Splitter` (`persistKey` `ahaswarm.split.browser.mobile`, `reverse`, `toggleAlign="start"`). Collapsed, it is just the model/generate strip (`collapseTo` = the measured strip height). Expanding from collapsed, or pressing the drag-bar chevron, opens it almost full height (`expandTo` / `defaultSize` = `browserMax`, leaving 4px at the top). The chevron is hidden when the drawer is at that top, and when a current image is showing. The drag bar itself stays (`dragFloor` is the strip height; the hit area is 44px). `--strip-h` is the measured strip height, also set on `document.documentElement`.

The strip has two rows: a horizontally scrolling model / presets / LoRA rail, then a generate row with a 48px hamburger on the left and a full-width Generate control (the interrupt button stays visible, muted when idle). That hamburger is a `Menu` (not dense): Parameters and Output first, a separator, then the browser tabs. The last selected tab shows the stock AhaKit check and is focused when the menu opens. Choosing the already-selected tab while the drawer is open closes it. The model rail and generate row move with the drawer.

On mobile, drawer tabs mount lazily. The first open waits until after the open animation (`requestAnimationFrame`, then `requestIdleCallback` with a 200ms timeout) before mounting the current tab, so the heavy grid does not hitch the motion. After that, the last opened tab stays mounted while the drawer is closed (hidden, `inert`, and `content-visibility: hidden`, not `display: none`). Switching tabs keeps at most the current tab and the previous one; older tabs unmount. `VirtualGrid` keeps its last visible window when the scroller is hidden, so reopening does not unload the cards. Desktop still mounts the current tab immediately and uses the same two-tab keep-alive.

Drawer content does not scroll sideways (`overflow-x: hidden` on the pane). History and Models keep the folder tree inside the drawer, over the grid, not as a `ScreenPanel`. A horizontal swipe on the list slides it in from the left. On History, the current breadcrumb folder (`Breadcrumb` `oncurrent`, mobile only) opens it too. Swipe either way again, the close button, or choosing a folder closes it.

Filter rows on History, Models, Presets and Simple are one line that scrolls (`overflow-x: auto`). Search, dropdowns and the depth stepper keep a fixed width so they stay usable; the row scrolls instead of shrinking them. Tools and Comfy stay a single compact scrolling line.

The Output panel uses a 3-column grid in portrait, or 2 columns when the output image size is 160px or larger. Cards use each image's aspect ratio rather than a fixed row height. A grouped set (a final image and its intermediates) uses that same column grid.

## Browser formats

In portrait, `formatOptions(true)` / `coerceFormat` / `formatLayout` in `lib/util/browserFormat.ts` (and the matching `.bf-thumbs` rules in `styles/browser.css`) apply:

- Small / default / big thumbnails are 4 / 3 / 2 columns
- Cards and Big Cards are hidden; they display as Small Cards (labelled "Cards") without writing that coercion to localStorage

History, Models, Presets and Simple pass `ui.portrait` into those helpers and into `VirtualGrid` (`rowExtra` sizes thumbnail rows from the column width).

## AhaKit behaviour on a narrow screen

These are general, not Generate-only:

- `Dropdown` does not autofocus its search field at `max-width: 768px`.
- `Modal` (when `dismissable`, and not a side `Drawer`) can be dragged down to close, from the header or from the body when `scrollTop` is 0. The threshold is 80px or 20% of the panel height. The image editor uses `dismissable={false}`, so it is not dismissed this way.
- Single-line inputs are 16px on coarse pointers (to avoid iOS zoom). Prompt textareas stay at `--text-ui` (13px) with `text-size-adjust: 100%`.
- `App.svelte` sets `overscroll-behavior-x: none` on `.app` at 768px.

## Browser back/forward

`lib/util/navGestures.ts` (`installNavGuard` from `App.svelte`) blocks:

- Alt+Left / Alt+Right, except in inputs, textareas, selects, contenteditable, and the image editor
- mouse buttons 3 and 4
- horizontal edge swipes on mobile, except those already handled by `data-swipe` or a horizontally scrolling ancestor

In-app hash navigation and native undo in the prompt box are left alone.
