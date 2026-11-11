# AhaKit components

Every AhaKit component: what it is for, its main props and events, and a real usage from the app. Pages import them from
`components/ui.ts`; AhaKit files import each other directly. The full prop tables are in `frontend/src/lib/ahakit/README.md`
and the source is the final word. To write a new component, see [writing-components.md](writing-components.md).

Callbacks are plain props (`onclick`, `onchange(v)`), bindable values use `bind:`, and snippet props (`footer`, `trigger`,
`overlay`, `actions`, `first`/`second`) are passed as `{#snippet name()}...{/snippet}` inside the component.

## Patterns used across the app

```svelte
<!-- popup with actions: primary = accent, destructive = red -->
<Modal bind:open class="model-info" title="Rename model" size="md" {onclose}>
    <FormRow label="File name"><TextInput bind:value={name} aria-label="File name" /></FormRow>
    {#snippet footer()}
        <Button onclick={cancel}>Cancel</Button>
        <Button variant="primary" disabled={!valid} onclick={rename}>Rename</Button>
    {/snippet}
</Modal>

<!-- small options panel from an icon button (BatchPanel) -->
<Popover bind:open={settingsOpen} title="Output options" label="Output options">
    {#snippet trigger(p)}<IconButton {...p} icon={LSettings} label="Output options" pressed={settingsOpen} />{/snippet}
    <SwitchRow label="Auto clear batch" info="Clear the batch when a new generation starts." checked={opts.autoClear} onchange={(v) => batchSettings.set('autoClear', v)} />
</Popover>

<!-- menu behind a button; destructive items use danger: true -->
<Menu items={[{ label: 'Rename', icon: LTextCursor, onselect: rename }, { label: 'Delete', icon: LTrash2, danger: true, onselect: del }]} label="More model actions">
    {#snippet trigger(p)}<Button {...p}>More <Icon icon={LChevronDown} /></Button>{/snippet}
</Menu>
```

Confirm destructive actions with `if (!(await ui.ask('Delete x?', 'This cannot be undone.', { confirmLabel: 'Delete' }))) return;`.

## Buttons and actions

### Button
Text button with an optional leading Lucide icon. The default action control.
- Props: `variant` default/primary/danger/ghost, `size`, `block`, `icon`, `iconOnly`, `fill`, `loading`, `done`, any
  `<button>` attribute
- Events: `onclick`. If it returns a promise, the button disables itself and swaps its icon for a spinner until the
  promise settles. A rejected promise shows an error toast, and `done` sets a success toast. Use `loading` when the
  pending state comes from somewhere else. IconButton passes all of this through.
- Used in `App.svelte`, and for an async action in `ServerPage.svelte`:

  ```svelte
  <Button onclick={reset}>Try again</Button>
  <Button icon={LMemory} onclick={() => act(() => api.freeBackendMemory(false), 'VRAM freed.')}>Free VRAM</Button>
  ```

### IconButton
Square icon-only button. `label` is the aria-label and the native tooltip (the one place tooltips belong).
- Props: `label`, `icon`, `variant` (ghost), `pressed`, `title`, children
- Events: `onclick`
- Used in `SimplePage.svelte`:

  ```svelte
  {#if running}<IconButton variant="danger" icon={LX} label="Interrupt" title="Interrupt the running generation" onclick={interrupt} />{/if}
  ```

### Icon
A Lucide icon at the standard 15px size, for icons inside custom markup.
- Props: `icon`, `title`, `strokeWidth`, `fill`, `class`
- Used in `ParamPanel.svelte`:

  ```svelte
  <button type="button" class="clear" aria-label="Clear filter" title="Clear filter" onclick={() => (paramState.filter = '')}><Icon icon={LX} /></button>
  ```

### ButtonGroup
Joins buttons into one segmented row (used by SplitButton).
- Props: `label`, `toolbar`, children

### SplitButton
Main button plus a chevron that opens a Menu (Generate, navbar split tabs).
- Props: `items`, `menuLabel`, `variant` primary/default/tab, `selected`, `contextMenu`, `block`, `icon`, `bind:open`; other attributes go to the main half
- Used in `GenerateControls.svelte`:

  ```svelte
  <SplitButton variant="primary" class="gen-btn" block items={genItems} menuLabel="Generate options" contextMenu bind:open={genMenuOpen}
  ```

### Toolbar
role=toolbar row with roving arrow-key focus.
- Props: `label` (required), `orientation`, `wrap`, children
- Used in `BatchPanel.svelte`:

  ```svelte
  <Toolbar label="Current batch">
  ```

### CopyChip
Chip that copies its value: clipboard icon, the value (ellipsized), a check for a moment after copying. Used for
trigger phrases everywhere (model info, cards, Details List) and by KeyValueList `copy` / `chips` rows.
- Props: `value`, `label` (aria-label, default "Copy <value>"), `class`
- Events: `oncopy(value)`
- Used in `ModelsPage.svelte`:

  ```svelte
  {#each triggers as t (t)}<CopyChip value={t} label="Copy trigger phrase {t}" />{/each}
  ```

### ColorSwatches

`recent`: a remembered custom colour (AhaSwarm: the last custom accent picked in any theme) shown as its own swatch, so it stays selectable after switching themes or picking another swatch.
Radio group of round colour swatches plus a custom colour well (`<input type="color">`). An option with value `''`
shows the theme's own accent (`--color-accent-default`).
- Props: `bind:value` (hex or ''), `options: {value,label,color?}[]`, `label`, `custom` (default true), `onchange(v)`
- Used in `SettingsPage.svelte`:

  ```svelte
  <ColorSwatches label="Accent colour" options={accentOptions} recent={ui.settings.lastCustomAccent} value={ui.settings.accents[ui.settings.theme] ?? ''} onchange={setAccentChoice} />
  ```
- Helpers in util.ts: `setAccent(hex | '')`, `accentTokens(hex)`, `onAccent(hex)`, `contrast(a, b)`, `luminance(hex)` (see theming.md).
- Theme registry in themes/index.ts: `THEMES` (id, label, isLight, file), `themeDef(id)`, `themeLabel(def)` (picker label, " (light)" on light themes), `themeAccentOptions()` (the '' "Theme default" option + the applied theme's `--accent-swatches`; call it after `setTheme`).

### SettingsSearch, SearchGroup, SearchItem
Search box for settings pages: filters by name, description and id (every query word must match; camelCase and
dotted ids are split, so "weight step" finds `ui.weightstep`). It shows "N matches", and the page adds an EmptyState
when nothing matches.
- `SettingsSearch` props: `bind:value` (plain query) or `scope` (a `SearchScope`), `count`, `placeholder`, `label`
- Data-driven pages call `matchesQuery(query, ...texts)` themselves. Used in `SettingsTree.svelte` (User settings,
  Server settings), where only sections with a match are shown:

  ```svelte
  <SettingsSearch bind:value={query} count={total} label="Search {label.toLowerCase()}" />
  ```
- Markup pages: `const search = provideSearch(new SearchScope())`, then wrap each section in
  `<SearchGroup title>` (its `children(searching)` snippet gets whether a search is active, to open the section) and
  each setting in `<SearchItem text>`. A section hides when neither its title nor any of its items match. Used in
  `SettingsPage.svelte` (AhaSwarm settings):

  ```svelte
  <SettingsSearch scope={search} label="Search AhaSwarm settings" />
  <SearchGroup title="Parameters">{#snippet children(searching)}
    <ParamGroup title="Parameters" open={searching}>
      <SearchItem text="Reset all parameters defaults"><Button …>Reset all parameters</Button></SearchItem>
    </ParamGroup>
  {/snippet}</SearchGroup>
  ```

### CopyButton
Icon button that copies text and confirms.
- Props: `text`, `label`, `size`
- Used in `MetadataView.svelte`:

  ```svelte
  <span class="copy" onclick={(e) => e.stopPropagation()}><CopyButton text={p.value} label="Copy {p.key}" /></span>
  ```

## Inputs

### TextInput
Single-line input.
- Props: `bind:value`, `label`, `hint`, `invalid`, `type`, `bind:ref`, any `<input>` attribute
- Events: `oninput(v)`, `onchange(v)`
- Used in `SimplePage.svelte`:

  ```svelte
  <div class="search"><TextInput type="search" aria-label="Search workflows" placeholder="Search workflows…" bind:value={search} /></div>
  ```

### Textarea
Auto-growing textarea (prompts, JSON).
- Props: `bind:value`, `rows`, `maxRows`, `autosize`, `mono`, `label`, `hint`, `bind:ref`
- Events: `oninput(v)`, `onchange(v)`, `onsubmit(v)` (Ctrl/Cmd+Enter), `onkeydown`
- Used in `ParamInput.svelte`:

  ```svelte
  <Textarea {id} rows={param.view_type === 'prompt' ? 2 : 1} value={`${st.values[param.id] ?? ''}`} oninput={(v: string) => setVal(v)} />
  ```

### NumberInput
Number box with steppers, wheel, scrub and clamping.
- Props: `bind:value`, `min` `max` `step`, `defaultValue`, `steppers`, `wheel`, `scrub`, `size` xs/sm/md, `label`/`ariaLabel`, `disabled`
- Events: `oninput(v)`, `onchange(v)`
- Used in `SettingsTree.svelte`:

  ```svelte
  <NumberInput ariaLabel={human(s.name)} value={Number(v)} step={s.type === 'integer' ? 1 : 0.01} onchange={(n: number) => edit(key, n)} />
  ```

### Slider
Range + NumberInput, with a view range separate from the typed limits and a log (pot) scale.
- Props: `bind:value`, `min` `max`, `viewMin` `viewMax`, `scale` linear/pot, `step`, `defaultValue`, `steppers`, `label`, `disabled`
- `info="..."` adds an InfoButton next to the label (Field `info`), e.g. the Output section's Image size in the Output options.
- Events: `oninput(v)`, `onchange(v)`
- Used in `ParamInput.svelte` (every numeric parameter):

  ```svelte
  <Slider {id} min={smin} max={smax} viewMin={vmin} viewMax={vmax} scale={isPot ? 'pot' : 'linear'} value={num} oninput={setVal} onchange={setVal} />
  ```

### Dropdown
Select (also exported as `Select`): portaled listbox, keyboard, type-ahead, search box when long.
- Props: `options: {value,label,title?,disabled?}[]`, `bind:value`, `placeholder`, `label`/`ariaLabel`, `size`, `searchable`, `disabled`
- Events: `onchange(v, option)`
- Used in `SimplePage.svelte`:

  ```svelte
  {#if folders.length}<div class="sel"><Dropdown ariaLabel="Folder" options={[{ value: '', label: 'All folders' }, ...folders.map(f => ({ value: f, label: f }))]} bind:value={folder} /></div>
  ```

### Toggle
Switch (role=switch) with an optional inline label.
- Props: `bind:checked`, `label`, `hideLabel`, `size` sm/md, `disabled`, children
- Events: `onchange(checked)`
- Used in `SimplePage.svelte`:

  ```svelte
  {#if advCount}<Toggle size="sm" label="Display advanced options ({advCount})" bind:checked={ui.settings.showAdvanced} onchange={() => ui.saveSettings()} />{/if}
  ```

### SwitchRow
Settings row: label + either a muted description or an info button, switch at the far right.
- Props: `label`, `description`, `info` (help text behind an InfoButton, keeps the row one line), `bind:checked`, `disabled`
- Events: `onchange(checked)`
- Used in `BatchPanel.svelte`:

  ```svelte
  <SwitchRow label={o.label} info={o.description} checked={opts[o.key]} onchange={(v) => batchSettings.set(o.key, v)} />
  ```

### InfoButton
Info icon that opens a Popover with help text; the same button as the parameter panel's info (ghost icon button, 24px
inside `.ui-dense`). Use it instead of an always-visible description in compact rows.
Works inside another Popover (the outer one stays open while the inner is used).
Also on every described setting in SettingsTree (User settings, Server settings): the description opens here, with no hover tooltip.
- Props: `label` (what it is about: the aria-label and tooltip are "About <label>"), `text` (lines split on `\n`) or children, `title`, `placement`, `bind:open`
- Used in `SwitchRow.svelte`:

  ```svelte
  {#if info}<InfoButton {label} text={info} />{/if}
  ```

### SegmentedControl
A few mutually exclusive options as joined buttons.
- Props: `options: {value,label,icon?}[]`, `bind:value`, `label`
- Events: `onchange(v)`
- Used in `SettingsPage.svelte`:

  ```svelte
  <SegmentedControl label="Settings source" value={mode} onchange={setMode} options={[{ value: 'aha', label: 'AhaSwarm', icon: LAppWindow }, { value: 'swarm', label: 'Swarm', icon: LCloud
  ```

### Field
Label/hint wrapper for a control; the label can scrub or reset (param panel).
- Props: `label`, `hint`, `title`, `forId`, `scrub`, `onreset`, children
- Used in `ParamInput.svelte`:

  ```svelte
  <Field label={param.name} forId={id}>{#snippet children()}{/snippet}</Field>
  ```

### FormRow
Label column + control (`.aha-frow`), wraps when narrow. Use for forms in modals and pages.
- Props: `label`, `icon`, `info` (text for an InfoButton after the label, like the param panel's), children
- Used in `UtilitiesPage.svelte`:

  ```svelte
  <FormRow label="Model sub-type"><Dropdown ariaLabel="Model sub-type" options={[{ value: 'all', label: 'All' }, ...Object.keys(paramState.models).map(k => ({ value: k, label: k }))]} b
  ```

### FileInput
Drop zone / file picker (also exported as `Dropzone`).
- Props: `accept`, `multiple`, `compact`, `label`, `hint`, `disabled`, children
- Events: `onfiles(files)`
- Used in `ParamInput.svelte`:

  ```svelte
  <FileInput compact accept={param.type.startsWith('audio') ? 'audio/*' : param.type.startsWith('video') ? 'video/*' : 'image/*'}
  ```

### ImageInput
Square image target with preview and clear (model preview editor).
- Props: `src`, `label`
- Events: `onfiles(files)`, `onclear()`
- Used in `ModelInfoModal.svelte`:

  ```svelte
  <ImageInput src={previewSrc} onfiles={onPreview} onclear={() => { preview = 'clear'; previewChanged = true; }} />
  ```

## Overlays

### Modal
Dialog with focus trap, Esc and backdrop close; bottom sheet on small screens. Prefer it over side panels.
- Props: `bind:open`, `title`, `subtitle`, `onsubtitleclick`, `size` sm/md/lg, `tone` raised/panel (panel = the param panel colour, for forms and info dialogs), `sheet`, `side`, `dismissable`, `class`, children, `footer` snippet
- Events: `onclose()`
- Used in `PresetsPage.svelte`:

  ```svelte
  <Modal bind:open={createOpen} title={editing ? `Edit preset "${editing.title}"` : 'Create new preset'} size="lg">
  ```

### Drawer
Full-height side Modal (the param drawer on narrow screens).
- Props: Modal props, `side` left/right
- Events: `onclose()`
- Used in `GeneratePage.svelte`:

  ```svelte
  <Drawer side="left" title="Parameters" bind:open={ui.paramsOpen}><div class="fill"><ParamPanel /></div></Drawer>
  ```

### BottomSheet
Modal forced into bottom-sheet form.
- Props: Modal props
- Events: `onclose()`

### ConfirmDialog
Yes/no dialog. App code calls `ui.ask()`; ConfirmHost renders it.
- Props: `title`, `message`, `confirmLabel`, `cancelLabel`, `danger`
- Events: `onresult(ok)`
- Used in `ConfirmHost.svelte`:

  ```svelte
  {#key r}<ConfirmDialog title={r.title} message={r.message} confirmLabel={r.confirmLabel} danger={r.danger} onresult={done} />{/key}
  ```

### Popover
Anchored panel opened by a `trigger` snippet (info popups, small option sets). A Popover opened from inside another keeps the outer one open; Escape closes the innermost.
- Props: `bind:open`, `title`, `label`, `placement`, `autofocus`, `compact` (tight padding, small title), `trigger` snippet (spread its props on the trigger), children
- Events: `onclose()`
- Used in `ParamInput.svelte`:

  ```svelte
  <Popover bind:open={infoOpen} title={param.name} label="{param.name} info">
  ```

### Tooltip
Rich hover/long-press tooltip for text that needs one (not for buttons; IconButton has its own).
- Props: `text` or `content` snippet, `placement`, `delay`, `touch`, `disabled`, children
- Used in `SettingsTree.svelte`:

  ```svelte
  <Tooltip text={plain(s.description) || s.name}><span class="name">{human(s.name)}</span></Tooltip>
  ```

### Menu
Dropdown or context menu from `MenuItem[]` (icons, danger, checked, submenus). Uses MenuList internally.
- Props: `items`, `bind:open`, `label`, `context`, `target`, `trigger` snippet; `openAt(x, y)` for context menus
- Events: `onselect(item)`
- Used in `PromptBox.svelte`:

  ```svelte
  <Menu items={plusItems} label="Prompt tools">
  ```

### Suggestions
Autocomplete popup anchored to an input or the caret.
- Props: `anchor`, `items`, `bind:open`, `bind:active`, `caret`, `item`/`empty` snippets
- Events: `onpick`, `onclose`
- Used in `PromptBox.svelte`:

  ```svelte
  <Suggestions anchor={key === 'prompt' ? posAnchor : negAnchor} items={suggItems} bind:open={suggOpen} bind:active={suggIdx}
  ```

### ToastContainer
Renders toasts; mounted once in App. Call `toast()` / `ui.toast()` instead.
- Props: `anchor`, `position`
- Used in `App.svelte`:

  ```svelte
  <ToastContainer anchor={'[aria-label="Generate controls"] .ui-group-btns'} />
  ```

## Navigation and layout

### Tabs
Tab bar; tabs listed in `menus` become tab-variant SplitButtons.
- Props: `tabs: {id,label,icon?}[]`, `bind:value`, `label`, `menus`, `panel` snippet
- Events: `onchange(id)`
- Used in `SettingsPage.svelte`:

  ```svelte
  {#if mode === 'swarm'}<Tabs tabs={swarmTabs} value={swarmTab} onchange={(id: string) => ui.setSub('settings', id)} label="Swarm settings sections" />{/if}
  ```

### Breadcrumb
Folder path with clickable segments.
- Props: `items: Crumb[]`, `label`
- Events: `onnavigate(crumb, index)`
- Used in `HistoryPage.svelte`:

  ```svelte
  <Breadcrumb label="Folder path" items={crumbItems} onnavigate={(_c, i) => (path = i === 0 ? '' : crumbs.slice(0, i).join('/'))} />
  ```

### Tree
Lazy folder tree with keyboard navigation.
- Props: `items: TreeItem[]`, `bind:selected`, `bind:expanded`, `label`, `loadChildren`, `followFocus`, `item` snippet
- Events: `onselect`, `onexpand`, `onactivate`
- Used in `HistoryPage.svelte`:

  ```svelte
  <Tree label="History folders" items={treeItems} bind:expanded={openKeys} selected={path} loadChildren={loadFolder}
  ```

### Splitter
Two resizable panes (drag, touch, keyboard, double-click reset, persisted, collapsible).
- Props: `direction`, `bind:size`, `bind:collapsed`, `min` `max` `defaultSize` `unit`, `collapsible`, `collapseTo`, `dragFloor`, `persistKey`, `label`, `first`/`second` snippets
- Events: `onresize`, `oncollapse`
- Used in `HistoryPage.svelte`:

  ```svelte
  <Splitter persistKey="ahaswarm.split.histtree" label="Resize folder tree" defaultSize={200} min={140} max={480} unit="px" collapsible>
  ```

### SplitHandle
The handle Splitter uses, for custom pane layouts.
- Props: the Splitter sizing props, `controls`
- Events: `onresize`, `oncollapse`

### Section
Static section card (`.aha-sec`) for page content.
- Props: `title`, `icon`, `plain`, `dense`, `lead`/`actions` snippets, children
- Used in `ServerPage.svelte`:

  ```svelte
  <Section icon={LActivity} title="Status">
  ```

### ParamGroup
Collapsible group heading with an optional enable toggle (param panel, Simple).
- Props: `title`, `icon`, `description`, `bind:open`, `toggleable`, `bind:enabled`, `actions` snippet
- Events: `ontoggle(open)`, `onenable(enabled)`
- Used in `SimplePage.svelte`:

  ```svelte
  <ParamGroup title={g.name} description={g.desc} open={g.open} ontoggle={(o: boolean) => localStorage.setItem(`ahaswarm.simple.open.${g.id}`, o ? 'open' : 'closed')}
  ```

## Data display

### KeyValueList
`<dl>` of facts with mono, copy and chip values.
- Props: `items: KeyValue[]` or a record, `dense`, `inline`, `label`
- Used in `BrowserCard.svelte`:

  ```svelte
  {#if facts.length}<KeyValueList label="Details" items={facts} inline />{/if}
  ```

### Stats
Icon stat rows in an auto-fill grid.
- Props: `items: {icon?,label,value}[]`, `label`
- Used in `ServerPage.svelte`:

  ```svelte
  <Stats label="Server status" items={[
  ```

### Badge
Small count/status pill.
- Props: `label` or children, `tone`, `title`
- Used in `ModelsPage.svelte`:

  ```svelte
  {#if shown.length}<p class="count"><Badge label="{shown.length} item{shown.length === 1 ? '' : 's'}" /></p>{/if}
  ```

### Chip
Tag chip; with `onclick` the label is a button; optional weight box and remove button (LoRAs).
- Props: `label`, `variant` default/active/include/exclude/danger, `bind:weight`, `min` `max` `step`, `removeLabel`, `disabled`, `prefix`/`extra` snippets, children
- Events: `onclick`, `onremove()`, `onweightchange(w)`
- Used in `MetadataView.svelte`:

  ```svelte
  <Chip label={r.id === 'model' ? r.name : `${r.param}: ${r.name}`} variant={isModelRefActive(r) ? 'active' : 'default'} onclick={() => useModelRef(r)} />
  ```

### StatusDot
Coloured status dot with a screen-reader or visible label.
- Props: `status` idle/queued/running/success/warning/error/offline, `label`, `showLabel`
- Used in `ServerPage.svelte`:

  ```svelte
  <StatusDot status={dotFor(s?.backend_status?.status)} label={s?.backend_status?.status ?? 'unknown'} showLabel />
  ```

### StatusText
One announced status line with a tone icon (spinner when busy).
- Props: `tone` idle/ok/warn/err/busy, `text`
- Used in `UtilitiesPage.svelte`:

  ```svelte
  <StatusText class="urlstat" tone={st.kind} text={st.text} />
  ```

### ProgressBar
Determinate or indeterminate (`value={null}`) bar.
- Props: `value`, `max`, `label`, `hideLabel`, `ariaLabel`, `showValue`
- Used in `App.svelte`:

  ```svelte
  <div class="boot"><ProgressBar value={null} label="Connecting to SwarmUI…" /></div>
  ```

### ProgressPair
Classic overall + current-step bars.
- Props: `overall`, `current`, `label`
- Used in `SimplePage.svelte`:

  ```svelte
  {#if progress}<ProgressPair overall={progress.all} current={progress.cur} label="Generating" />{/if}
  ```

### QueueItem
Job row with status dot, progress and a red (danger) cancel button.
- Props: `title`, `meta`, `thumb`, `status`, `progress`, `selected`, `actions` snippet
- Events: `onclick`, `oncancel`
- Used in `BatchPanel.svelte`:

  ```svelte
  <QueueItem title={j.prompt || '(empty prompt)'} meta="{j.images}× - generating" status="running"
  ```

### TaskCard
Long-running task card (downloads, conversions) with image, progress and actions.
- Props: `title`, `icon`, `image`, `progress`, `state`, `status`, `actions` snippet, children
- Events: `ondismiss`, `oncancel`
- Used in `UtilitiesPage.svelte`:

  ```svelte
  <TaskCard title={j.name} image={j.image} state={j.state} progress={j.state === 'run' && j.prog ? { overall: j.prog.all, current: j.prog.cur } : null} oncancel={j.state === 'run' ? ()
  ```

### ListRow
Generic list row (thumb, title, meta, progress, actions); base of QueueItem.
- Props: `title`, `meta`, `thumb`, `progress`, `selected`, `leading`/`actions` snippets
- Events: `onclick`

### FitTitle
A file-like name fitted to a small box (the caption under thumbnails). Cleans it (`cleanTitle`: no extension, `_` as
spaces), balances it over `lines` lines (`text-wrap: balance`) with `<wbr>` break points after `-` `/` `+`, after `.`
outside numbers and at camelCase humps, steps the font down through `sizes` for long names and, past that, cuts the
middle (`middleEllipsis`) so the start and the version suffix stay visible. The full name stays in the accessible text;
the visible box is a hint, the click target opens the full info. Pure string math (average glyph width), no DOM measuring.
- Props: `text`, `width` (px; 0 = only clean), `lines` (2), `sizes` ([12, 11, 10]), `clean` (true), `class`
- Helpers in fitTitle.ts: `cleanTitle`, `breakParts`, `fitTitle(text, { width, lines, sizes, glyph })`, `middleEllipsis(text, max)`
- Used in `BrowserCard.svelte` (thumbnail layouts, box from `labelFit(format)` in browserFormat.ts):

  ```svelte
  <FitTitle text={label} width={labelFit.width} lines={labelFit.lines} sizes={labelFit.lines > 1 ? [12, 11, 10] : [11, 10]} />
  ```

### GalleryCard
Image/video card: lazy load, skeleton, error icon, selection, live previews, spinner.
- Props: `src`, `alt`, `caption`, `selected`, `aspect`, `fit`, `eager`, `video`, `autoplay`, `live`, `busy`, `cache` (load through the image blob cache), `selectable`, `bind:checked`, `selecting`, `overlay` snippet
- Row layout (Output section, like classic's batch): `aspect="auto" rowHeight="var(--batch-row)"` gives one height and each image's own width; `badge` puts a short label (Intermediate, Grid, 42%) over the media; `oncontextmenu` for a per-image menu. `ratio="768 / 1344"` sizes the card before its media loads (placeholders take the requested size, so the final image replaces them without a jump).
- Events: `onclick` (makes it a button), `oncheck`
- Used in `SimplePage.svelte`:

  ```svelte
  {#each batch as b, i (b.src + i)}<div class="th">{#if isVideo(b.src) || isAudio(b.src)}<button class="media" class:on={b.src === current} onclick={() => (current = b.src)}>{isVideo(b.src) ?
  ```

### ImageGrid
Selectable responsive image grid.
- Props: `items`, `bind:selected`, `multiple`, `minSize`, `aspect`, `item` snippet
- Events: `onselect`, `onselectionchange`

### CodeBlock
Monospace block with a copy button.
- Props: `code`, `language`, `wrap`, `copy`, `maxHeight`
- Used in `ModelHeaderModal.svelte`:

  ```svelte
  <CodeBlock code={text} language="json" maxHeight="65vh" />
  ```

### LogViewer
Scrolling log with autoscroll.
- Props: `lines` or `text`, `bind:autoscroll`, `wrap`, `height`, `label`
- Used in `ServerPage.svelte`:

  ```svelte
  <LogViewer label="Server log" wrap height="calc(100vh - 200px)" lines={shownLogs.map(l => `[${l.t}] [${l.type}] ${l.msg}`)} />
  ```

### VirtualGrid
Windowed grid/list for long collections: fixed row height, columns from the container width and centred (fixed
columns split the spare width on both sides, `{ min }` columns grow to at most 1.6 x min, never more columns than items), only the visible rows
plus `overscan` screens mounted (off-screen cards and their decoded images are released), exact stable total height.
Scrolls with its nearest scrolling ancestor; scroll is read passively once per frame. When its scroller is hidden
(display: none) it mounts nothing and restores the scroll position when shown again. Pair with `GalleryCard cache` so
re-mounted images never download again.
- Props: `items`, `key(item, i)`, `columns` (number, `{ min }` stretched or `{ width }` fixed px), `rowHeight` (px),
  `gap`, `colGap`, `overscan` (screens, default 2), `class` (on the item grid, e.g. the `.bf` format classes), `label`,
  `scroller`, `item` snippet `(item, index)`
- Used in `ModelsPage.svelte` (geometry per display format from `formatLayout()` in `lib/util/browserFormat.ts`):

  ```svelte
  <VirtualGrid items={ordered} key={(m: ModelInfo) => m.name} {...layout} class={formatClass(format)} label={subtype}>
      {#snippet item(m: ModelInfo)}<BrowserCard ... />{/snippet}
  </VirtualGrid>
  ```

### LoadMore
End of an incrementally rendered list (`items.slice(0, limit)`): a "Show more (n left)" button, or with `auto` an
invisible sentinel that loads the next page as it nears the viewport (infinite scroll). Renders nothing when done.
- Props: `remaining`, `auto`, `label`, `margin` (IntersectionObserver rootMargin, default 800px)
- Events: `onmore()`
- Used in `HistoryPage.svelte`:

  ```svelte
  <LoadMore remaining={files.length - limit} auto={infinite} onmore={() => (limit += PAGE)} />
  ```

### EmptyState
Icon + title + message for empty or error panes.
- Props: `icon`, `title`, `message`, children (actions)
- Used in `ServerPage.svelte`:

  ```svelte
  {#if backendsErr}<EmptyState icon={LTriangleAlert} title="Couldn't load backends" message={backendsErr} />{/if}
  ```

### Skeleton
Loading block, lines or circle with the shimmer. Shape it like the real layout.
- Props: `width`, `height`, `radius`, `lines`, `circle`, `fill`, `label`
- Used in `SimplePage.svelte`:

  ```svelte
  {#if !wf}<Skeleton lines={6} label="Loading workflow" />{/if}
  ```

## Helpers

From `$ahakit`: `toast(msg, {kind, title, timeout, action})`, `toastSuccess/Warning/Error`, `dismiss(id)`; `copyText(text)`;
`uid(prefix)`, `clamp`, `snap`, `fitNumber`; the image cache (`loadImage(src)`, `cachedImage(src)`, `holdImage(src)`:
a 96 MB LRU of fetched image blobs as object URLs, so windowed lists re-show images without a new download); the `portal` action, `longPress`, `rangeSelect`, `placePopover`, `setTheme(id)` (sets `data-theme` on `<html>`, picking a `themes/*.css` file: 'dark' (also '' / 'default'), 'light', 'ctp-mocha', ...), `setContrast(high)` (`data-contrast="high"`), `applyContrastMode('auto' | 'on' | 'off')` (Auto follows prefers-contrast / forced-colors live; returns the cleanup), `systemWantsContrast()`, `setAccent(hex)` (see theming.md), and the `scrollHint` action (a small scroll area inside a
list, e.g. card details: overflow hidden with a drawn scrollbar on hover, scrolls only once clicked or focused; no wheel
listeners, so the list keeps native smooth scrolling).
Sanitizing (`sanitize.ts`, the only place for this): `escapeHtml`, `decodeEntities`, `stripTags(h, oneLine)` (HTML
hidden, for text), `htmlToText` (inert DOMParser), `safeUrl(u)` (http(s)/mailto/relative only, else ''), and
`linkify(text)`, the only allowed input for `{@html}` (escaped text, line breaks, safe links). Use `safeUrl` for every
`href` or `window.open` built from server or metadata data.

Types: `KeyValue`, `MenuItem`, `MenuTriggerProps`, `TreeItem`, `SuggestItem`, `Crumb`, `Status`, `Tone`, `LucideIcon`.

App wrappers (`lib/state/ui.svelte.ts`): `ui.toast(msg, kind)`, `ui.error(e)`, `await ui.ask(title, message, { confirmLabel, danger })`.

Theme hooks: selected / pressed controls use `--color-pressed*` / `--color-on-pressed` and `--edge-pressed*` (default: the accent fill), `.ctl-strong` / `.ctl-danger` use `--edge-strong`, and text fields (`.ctl-field`, Textarea, NumberInput) use `--color-field` (unset = control surface) and `--edge-field`. See docs/theming.md.

GalleryCard / BrowserCard `placeholder`: when `src` is empty, an image icon and this text (hidden in boxes under ~72×56px) replace the loading skeleton. Models use it for "No preview" through `modelPreviewSrc()` (lib/state/models.ts), which follows the AhaSwarm setting *Models without a preview image*: Icon (default) or Swarm image (`imgs/model_placeholder.jpg`, fitted like any card image).

Status fills (danger buttons, chips, badges, error toast) use `--color-danger-fg` / `--color-success-fg` / `--color-warning-fg` / `--color-info-fg` for text and icons. See docs/theming.md.

Server Manager layout: Status (tiles via `Stats variant="tiles"`, then a KeyValueList), Resource usage (ProgressBar meters with `detail`, two per row, a block per GPU with VRAM and utilization meters and a temperature Badge), Connected users (Sessions column only when someone has sessions), and one Actions section of text | buttons rows (danger kept on Interrupt, Update and Restart, Shut Down).

### CommitList
`<CommitList lines={updates.server.preview} label="SwarmUI pending commits" />`: pending commits as a timeline (commit icon on a rail, subject, date; "..." becomes a gap). Used by Server Manager > Actions > Updates, one per target with a Toggle (classic update-check rows).

### VideoPlayer
`<VideoPlayer {src} muted label={fileName(src)} />`: replaces `<video controls>` in the current image, the image viewer and Simple. Plyr-like layout from AhaKit IconButton, Slider and Menu (no Plyr dependency): controls show while paused, hovered, focused or the settings menu is open, and hide ~2s after the pointer stops while playing. Popovers and menus portal into the full-screen element while one is shown.

### AudioPlayer
`<AudioPlayer {src} label={fileName(src)} />`: replaces `<audio controls>` in the current image and Simple, with a static seekable waveform. Needs a same-origin (or CORS) source for the waveform; otherwise it plays with a flat line.

### Grid
`<Grid cols={2} min="380px" label="Server info">…sections…</Grid>`: the shared masonry page grid (two column stacks, no row alignment; `.aha-grid` in layout.css, placement in Grid.svelte via one ResizeObserver). Use it instead of per-page grid CSS; `class="aha-span"` on a child makes it full width. `balance` plans the columns once from every section's expanded height and keeps them fixed while sections open or close (settings pages).

## Behaviour notes

Non-obvious behaviour some components rely on; keep it when changing them.

- **VirtualGrid** mounts only visible rows, so off-screen cards release their decoded images; its total height is exact,
  so scrolling never jumps. Columns grow to at most 1.6× `min`, so a short last row doesn't leave a lopsided column.
- **imageCache** fetches each `src` once (concurrent callers share the request) and never evicts an entry a mounted
  image uses, so a card scrolled back into view shows its image without downloading it again.
- **GalleryCard** keeps the last frame when `src` changes in place (live previews) instead of fading each one in.
- **Grid** keeps items in stable columns: collapsing a section never moves another to the other column.
- **Textarea** autosize measures with `height: auto`, so it saves and restores the scroll position and only touches
  `overflow` when it changes (otherwise the scrollbar flickers while typing).
- **SplitHandle**'s edge toggle follows the pointer along the edge (out of `avoid` ranges), never while dragging, on
  coarse pointers or with keyboard focus; it hides over clickable things much smaller than itself. `dragFloor` keeps a
  collapsible pane's live drag above a toolbar row; `collapseTo` > 0 collapses to a persistent strip.
- **ToastContainer** stays above the button that triggered it when a centred dialog is open, instead of covering the
  dialog's footer.
- **Slider** spans `view_min`..`view_max` (the number box takes the full `min`..`max`), as classic `makeSliderInput`.
- **AudioPlayer** redraws on time updates, hover and resize, never in an animation loop; cross-origin or undecodable
  files show a flat line.
- **sanitize.ts** is the one place untrusted text (model or image metadata, server HTML, file names) becomes markup:
  never `{@html}` anything that didn't come out of `linkify()`.
- **fitTitle** picks the largest size that fits; at the smallest size it cuts the middle, so the start and a version
  suffix (v2.1, fp16, XL…) both stay visible.
