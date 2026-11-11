<script lang="ts">
    import LBrush from '@lucide/svelte/icons/paintbrush';
    import LClipboard from '@lucide/svelte/icons/clipboard';
    import LEllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
    import LClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
    import LClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
    import LScissors from '@lucide/svelte/icons/scissors';
    import LDownload from '@lucide/svelte/icons/download';
    import LHistory from '@lucide/svelte/icons/history';
    import LTrash2 from '@lucide/svelte/icons/trash-2';
    import LSave from '@lucide/svelte/icons/save';
    import LCircleDashed from '@lucide/svelte/icons/circle-dashed';
    import LEraser from '@lucide/svelte/icons/eraser';
    import LHand from '@lucide/svelte/icons/hand';
    import LLasso from '@lucide/svelte/icons/lasso';
    import LLassoSelect from '@lucide/svelte/icons/lasso-select';
    import LLayers from '@lucide/svelte/icons/layers';
    import LMove from '@lucide/svelte/icons/move';
    import LPaintBucket from '@lucide/svelte/icons/paint-bucket';
    import LPipette from '@lucide/svelte/icons/pipette';
    import LRedo2 from '@lucide/svelte/icons/redo-2';
    import LSlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
    import LSprayCan from '@lucide/svelte/icons/spray-can';
    import LSquareDashed from '@lucide/svelte/icons/square-dashed';
    import LType from '@lucide/svelte/icons/type';
    import LUndo2 from '@lucide/svelte/icons/undo-2';
    import LWandSparkles from '@lucide/svelte/icons/wand-sparkles';
    import LX from '@lucide/svelte/icons/x';
    import LZoomIn from '@lucide/svelte/icons/zoom-in';
    import LZoomOut from '@lucide/svelte/icons/zoom-out';
    import type { Editor, ToolId } from '../../lib/editor/editor.svelte';
    import { editorState } from '../../lib/state/editor.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { BottomSheet, IconButton, Menu, Popover, Toolbar, type LucideIcon, type MenuItem } from '../ui';
    import EditorColor from './EditorColor.svelte';
    import EditorLayers from './EditorLayers.svelte';
    import EditorToolOptions from './EditorToolOptions.svelte';

    let { editor }: { editor: Editor } = $props();

    // phones get the whole screen (same breakpoint as GeneratePage)
    const mq = typeof matchMedia === 'function' ? matchMedia('(max-width: 760px)') : null;
    let narrow = $state(mq?.matches ?? false);
    $effect(() => {
        if (!mq) {
            return;
        }
        const on = (e: MediaQueryListEvent) => (narrow = e.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    });

    const TOOLS: { id: ToolId; icon: LucideIcon; label: string; key: string }[] = [
        { id: 'brush', icon: LBrush, label: 'Brush', key: 'B' },
        { id: 'airbrush', icon: LSprayCan, label: 'Airbrush', key: 'A' },
        { id: 'eraser', icon: LEraser, label: 'Eraser', key: 'E' },
        { id: 'fill', icon: LPaintBucket, label: 'Paint bucket', key: 'G' },
        { id: 'lassofill', icon: LLasso, label: 'Lasso fill', key: 'F' },
        { id: 'eyedropper', icon: LPipette, label: 'Eyedropper', key: 'I' },
        { id: 'rect', icon: LSquareDashed, label: 'Rectangle select', key: 'M' },
        { id: 'ellipse', icon: LCircleDashed, label: 'Ellipse select', key: 'O' },
        { id: 'lasso', icon: LLassoSelect, label: 'Lasso select', key: 'L' },
        { id: 'move', icon: LMove, label: 'Move', key: 'V' },
        { id: 'liquify', icon: LWandSparkles, label: 'Liquify (push)', key: 'W' },
        { id: 'text', icon: LType, label: 'Text', key: 'T' },
        { id: 'hand', icon: LHand, label: 'Pan', key: 'H' },
    ];

    let rootEl = $state<HTMLElement>();
    let canvasEl = $state<HTMLCanvasElement>();
    let stageEl = $state<HTMLDivElement>();
    let optsOpen = $state(false);
    let layersOpen = $state(false);
    let colorOpen = $state(false);

    $effect(() => {
        const c = canvasEl, s = stageEl;
        if (!c || !s) {
            return;
        }
        const detach = editor.attach(c);
        const ro = new ResizeObserver(() => editor.resize(s.clientWidth, s.clientHeight));
        ro.observe(s);
        return () => { ro.disconnect(); detach(); };
    });

    $effect(() => {
        if (narrow && (editor.editingText !== null || editor.xform)) {
            optsOpen = true;
        }
    });

    function otherDialogOpen(): boolean {
        const own = rootEl?.closest('.ui-modal');
        return [...document.querySelectorAll('.ui-modal')].some(m => m !== own);
    }

    function typing(t: EventTarget | null): boolean {
        const el = t as HTMLElement | null;
        return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    }

    function onkeydown(e: KeyboardEvent) {
        if (typing(e.target) || otherDialogOpen()) {
            return;
        }
        const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
        if (e.key === ' ') {
            editor.setKeyState('space', true);
            e.preventDefault();
            return;
        }
        if (e.key === 'Alt') {
            editor.setKeyState('alt', true);
            e.preventDefault();
            return;
        }
        let done = true;
        if (editor.xform && k === 'enter') editor.applyTransform();
        else if (editor.xform && k === 'escape') editor.cancelTransform();
        else if (editor.editingText !== null && k === 'escape') editor.finishText();
        else if (mod && k === 't') editor.startTransform();
        else if (mod && k === 'c') editor.copy(e.shiftKey);
        else if (mod && k === 'x') editor.cut();
        else if (mod && k === 'v') done = false;
        else if (mod && k === 'z') e.shiftKey ? editor.redo() : editor.undo();
        else if (mod && k === 'y') editor.redo();
        else if (mod && k === 'a') editor.selectAll();
        else if (mod && k === 'd') editor.deselect();
        else if (mod && e.shiftKey && k === 'i') editor.invertSelection();
        else if (mod && k === '0') editor.fit();
        else if (mod || e.altKey) done = false;
        else if (k === 'escape' && editor.hasSelection) editor.deselect();
        else if ((k === 'delete' || k === 'backspace') && editor.hasSelection) editor.clearSelected();
        else if (k === '[' || k === ']') {
            const b = editor.brush ?? (editor.tool === 'liquify' ? editor.liquify : null);
            if (b) b.size = k === ']' ? Math.min(1000, Math.max(b.size + 1, Math.round(b.size * 1.15))) : Math.max(1, Math.min(b.size - 1, Math.round(b.size / 1.15)));
        }
        else if (k === 'x') editor.swapColors();
        else if (k === '+' || k === '=') editor.zoomBy(1.25);
        else if (k === '-') editor.zoomBy(0.8);
        else {
            const t = TOOLS.find(t => t.key.toLowerCase() === k);
            if (t) editor.setTool(t.id);
            else done = false;
        }
        if (done) {
            e.preventDefault();
        }
    }

    function onkeyup(e: KeyboardEvent) {
        if (e.key === ' ') editor.setKeyState('space', false);
        if (e.key === 'Alt') editor.setKeyState('alt', false);
    }

    function loadBlob(blob: Blob): void {
        const url = URL.createObjectURL(blob), img = new Image();
        img.onload = () => { editor.pasteImage(img); URL.revokeObjectURL(url); };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
    }

    // Ctrl+V arrives as a paste event: an image copied in another app since our own copy wins, else our clipboard
    function onpaste(e: ClipboardEvent) {
        if (typing(e.target) || otherDialogOpen()) {
            return;
        }
        const file = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile();
        if (file && (!editor.hasClipboard || editor.clipMaybeStale)) {
            loadBlob(file);
        }
        else if (editor.hasClipboard) {
            editor.paste();
        }
        else {
            return;
        }
        e.preventDefault();
    }

    // the Edit menu has no paste event to read, so it asks the async clipboard (may prompt) when ours is empty or stale
    async function pasteFromMenu() {
        if (editor.hasClipboard && !editor.clipMaybeStale) {
            editor.paste();
            return;
        }
        try {
            for (const item of await navigator.clipboard.read()) {
                const type = item.types.find(t => t.startsWith('image/'));
                if (type) {
                    loadBlob(await item.getType(type));
                    return;
                }
            }
        }
        catch {
            // no permission or not a secure page: fall back to our own clipboard
        }
        if (editor.hasClipboard) {
            editor.paste();
        }
        else {
            ui.toast('Nothing to paste. Copy a selection or an image first.', 'info');
        }
    }

    const editItems = $derived<MenuItem[]>([
        { label: 'Cut', icon: LScissors, shortcut: 'Ctrl+X', disabled: !!editor.xform, onselect: () => editor.cut() },
        { label: 'Copy', icon: LClipboardCopy, shortcut: 'Ctrl+C', disabled: !!editor.xform, onselect: () => editor.copy() },
        { label: 'Copy Merged', shortcut: 'Ctrl+Shift+C', disabled: !!editor.xform, onselect: () => editor.copy(true) },
        { label: 'Paste', icon: LClipboardPaste, shortcut: 'Ctrl+V', disabled: !!editor.xform, onselect: pasteFromMenu },
        { separator: true },
        { label: 'Select All', shortcut: 'Ctrl+A', onselect: () => editor.selectAll() },
        { label: 'Deselect', shortcut: 'Ctrl+D', disabled: !editor.hasSelection, onselect: () => editor.deselect() },
        { label: 'Invert Selection', shortcut: 'Ctrl+Shift+I', disabled: !editor.hasSelection, onselect: () => editor.invertSelection() },
        { label: 'Transform', shortcut: 'Ctrl+T', disabled: !!editor.xform, onselect: () => editor.startTransform() },
    ]);

    function saveTo(full: boolean) {
        editorState.saveToHistory(full).catch(e => ui.error(e));
    }

    const saveItems: MenuItem[] = [
        { label: 'Download PNG', icon: LDownload, title: 'Saves the edited image to your device', onselect: () => editorState.download() },
        { label: 'Save To History', icon: LHistory, title: 'Stores the edited image in Image History with the current parameters', onselect: () => saveTo(false) },
        { label: 'Save Full Canvas To History', title: 'Also keeps anything moved past the canvas edges', onselect: () => saveTo(true) },
        { separator: true },
        { label: 'Discard Edits', icon: LTrash2, danger: true, title: 'Closes the editor; generations stop using the edit', onselect: () => editorState.discard() },
    ];

</script>

<svelte:window {onkeydown} {onkeyup} {onpaste} onblur={() => { editor.setKeyState('space', false); editor.setKeyState('alt', false); editor.clipMaybeStale = true; }} />

{#snippet toolButtons()}
    {#each TOOLS as t (t.id)}
        <IconButton icon={t.icon} label="{t.label} ({t.key})" pressed={editor.tool === t.id} onclick={() => editor.setTool(t.id)} />
    {/each}
{/snippet}

<!-- the modal focuses [autofocus] first: the editor itself, not its first toolbar button -->
<!-- svelte-ignore a11y_autofocus -->
<section class="ed" class:narrow aria-label="Image editor" bind:this={rootEl} tabindex="-1" autofocus>
    <header class="bar" class:narrow>
        <Toolbar label="Editor" wrap={!narrow}>
            <IconButton icon={LUndo2} label="Undo (Ctrl+Z)" disabled={!editor.canUndo} onclick={() => editor.undo()} />
            <IconButton icon={LRedo2} label="Redo (Ctrl+Shift+Z)" disabled={!editor.canRedo} onclick={() => editor.redo()} />
            {#if narrow}
                <!-- phones: one menu, so the header fits on a 360px screen -->
                <Menu items={[...saveItems, { separator: true }, ...editItems]} label="Save and edit">
                    {#snippet trigger(p)}<IconButton {...p} icon={LEllipsisVertical} label="Save, copy, paste, selection" />{/snippet}
                </Menu>
            {:else}
                <Menu items={editItems} label="Edit">
                    {#snippet trigger(p)}<IconButton {...p} icon={LClipboard} label="Edit: copy, paste, selection" />{/snippet}
                </Menu>
                <Menu items={saveItems} label="Save">
                    {#snippet trigger(p)}<IconButton {...p} icon={LSave} label="Save: download or store to history" />{/snippet}
                </Menu>
            {/if}
        </Toolbar>
        {#if narrow}
            <Popover bind:open={optsOpen} title="Tool options" label="Tool options">
                {#snippet trigger(p)}<IconButton {...p} icon={LSlidersHorizontal} label="Tool options" pressed={optsOpen} />{/snippet}
                <div class="pop-opts"><EditorToolOptions {editor} /></div>
            </Popover>
            <button type="button" class="swatch" style="background:{editor.color}" aria-label="Colour" title="Colour" onclick={() => (colorOpen = true)}></button>
            <IconButton icon={LLayers} label="Layers" onclick={() => (layersOpen = true)} />
            <span class="grow"></span>
            <IconButton icon={LX} label="Close (your edit stays active)" onclick={() => editorState.hide()} />
        {:else}
            <div class="opts"><EditorToolOptions {editor} /></div>
            <Toolbar label="Zoom">
                <IconButton icon={LZoomOut} label="Zoom out (-)" onclick={() => editor.zoomBy(0.8)} />
                <button type="button" class="zoom" title="Zoom level: click to fit the view (Ctrl+0)" onclick={() => editor.fit()}>{Math.round(editor.zoom * 100)}%</button>
                <IconButton icon={LZoomIn} label="Zoom in (+)" onclick={() => editor.zoomBy(1.25)} />
            </Toolbar>
            <IconButton icon={LX} label="Close (your edit stays active)" onclick={() => editorState.hide()} />
        {/if}
    </header>
    <div class="main">
        {#if !narrow}
            <nav class="rail"><Toolbar label="Tools" orientation="vertical">{@render toolButtons()}</Toolbar></nav>
        {/if}
        <div class="stage" bind:this={stageEl}>
            <canvas bind:this={canvasEl} aria-label="Image canvas, {editor.width} by {editor.height}"></canvas>
            <span class="size">{editor.width} × {editor.height}</span>
        </div>
        {#if !narrow}
            <aside class="side">
                <EditorColor {editor} />
                <EditorLayers {editor} />
            </aside>
        {/if}
    </div>
    {#if narrow}
        <nav class="strip"><Toolbar label="Tools" wrap={false}>{@render toolButtons()}</Toolbar></nav>
        <BottomSheet bind:open={colorOpen} title="Colour"><EditorColor {editor} /></BottomSheet>
        <BottomSheet bind:open={layersOpen} title="Layers"><div class="sheet-layers"><EditorLayers {editor} /></div></BottomSheet>
    {/if}
</section>

<style>
    .ed:focus { outline: none; }
    .ed { flex: 1; height: 100%; min-height: 0; display: flex; flex-direction: column;
        --editor-check-a: #cfcfcf; --editor-check-b: #f2f2f2; }
    .bar { display: flex; align-items: center; gap: var(--space-3); min-height: 48px; padding: var(--space-1) var(--space-2); background: var(--color-raised); flex-wrap: wrap; }
    .bar.narrow { flex-wrap: nowrap; gap: var(--space-1); padding: var(--space-1); }
    .opts { flex: 1; min-width: 0; }
    .grow { flex: 1; }
    .zoom { all: unset; min-width: 46px; text-align: center; font-variant-numeric: tabular-nums; font-size: var(--text-small); color: var(--color-ink-2); cursor: pointer; border-radius: var(--radius-sm); padding: 2px 4px; }
    .zoom:hover { background: var(--color-hover); }
    .zoom:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
    .main { flex: 1; min-height: 0; display: flex; }
    .rail { padding: var(--space-1); background: var(--color-raised); overflow-y: auto; }
    /* see-through around the picture, so the page shows (dimmed) behind the editor */
    .stage { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: color-mix(in srgb, var(--color-base) 55%, transparent); }
    .stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; display: block; }
    .size { position: absolute; left: var(--space-2); bottom: var(--space-1); font-size: var(--text-small); color: var(--color-ink-3); pointer-events: none; }
    .side { width: 260px; flex: none; display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3); background: var(--color-raised); overflow-y: auto; min-height: 0; }
    .strip { background: var(--color-raised); overflow-x: auto; padding: var(--space-1); }
    .swatch { width: 26px; height: 26px; border-radius: 50%; border: 0; padding: 0; box-shadow: 0 0 0 2px var(--color-panel), 0 0 0 3px var(--color-border-strong); cursor: pointer; flex: none; }
    .pop-opts { max-width: min(92vw, 420px); }
    .pop-opts :global(.opts) { flex-direction: column; align-items: stretch; }
    .pop-opts :global(.sl) { width: auto; }
    .pop-opts :global(.lbl) { width: 64px; }
    .pop-opts :global(.txt) { flex: none; }
    .sheet-layers { min-height: 40vh; }
</style>
