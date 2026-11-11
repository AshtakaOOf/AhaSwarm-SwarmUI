<script lang="ts">
    import LArrowDown from '@lucide/svelte/icons/arrow-down';
    import LArrowUp from '@lucide/svelte/icons/arrow-up';
    import LCopy from '@lucide/svelte/icons/copy';
    import LEllipsis from '@lucide/svelte/icons/ellipsis';
    import LEye from '@lucide/svelte/icons/eye';
    import LEyeOff from '@lucide/svelte/icons/eye-off';
    import LImagePlus from '@lucide/svelte/icons/image-plus';
    import LListChecks from '@lucide/svelte/icons/list-checks';
    import LMerge from '@lucide/svelte/icons/merge';
    import LPlus from '@lucide/svelte/icons/plus';
    import LTrash2 from '@lucide/svelte/icons/trash-2';
    import LVenetianMask from '@lucide/svelte/icons/venetian-mask';
    import type { Editor } from '../../lib/editor/editor.svelte';
    import type { Layer } from '../../lib/editor/layer';
    import { IconButton, Menu, Slider, Toolbar, type MenuItem } from '../ui';
    import { ui } from '../../lib/state/ui.svelte';

    let { editor }: { editor: Editor } = $props();

    // top of the stack first, like most paint apps
    const list = $derived([...editor.layers].reverse());
    const active = $derived(editor.rev >= 0 ? editor.active : null);
    let renaming = $state<number | null>(null);
    // tap-to-select-several, for touch screens without Ctrl / Shift
    let multi = $state(false);
    const selected = $derived(editor.rev >= 0 ? editor.selectedLayers : []);
    const isSel = (l: Layer) => l.id === editor.activeId || editor.extraSel.includes(l.id);
    let fileEl = $state<HTMLInputElement>();
    let opacityStart: number | null = null;

    function thumb(node: HTMLCanvasElement, arg: { layer: Layer; rev: number }) {
        const draw = ({ layer }: { layer: Layer; rev: number }) => {
            const ctx = node.getContext('2d')!;
            const s = Math.min(node.width / editor.width, node.height / editor.height);
            ctx.clearRect(0, 0, node.width, node.height);
            ctx.save();
            ctx.translate((node.width - editor.width * s) / 2, (node.height - editor.height * s) / 2);
            ctx.scale(s, s);
            if (layer.isMask) {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, editor.width, editor.height);
            }
            ctx.drawImage(layer.canvas, layer.x, layer.y);
            ctx.restore();
        };
        draw(arg);
        return { update: draw };
    }

    function rename(l: Layer, name: string) {
        renaming = null;
        const n = name.trim();
        if (n && n !== l.name) {
            editor.setLayerProps(l, { name: n });
        }
    }

    async function remove(list: Layer[]) {
        const what = list.length > 1 ? `${list.length} layers` : `"${list[0].name}"`;
        if (list.some(l => l.hasContent()) && !(await ui.ask(`Delete ${what}?`, 'You can undo this with Ctrl+Z.', { confirmLabel: 'Delete' }))) {
            return;
        }
        editor.deleteLayers(list);
    }

    function pick(e: MouseEvent, l: Layer) {
        editor.selectLayer(l.id, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey || multi ? 'toggle' : 'replace');
    }

    const pendingUrls = new Set<string>();
    $effect(() => () => { for (const url of pendingUrls) URL.revokeObjectURL(url); pendingUrls.clear(); });

    function importFile(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) {
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        pendingUrls.add(url);
        const done = () => pendingUrls.delete(url) && URL.revokeObjectURL(url);
        img.onload = () => { if (pendingUrls.has(url)) { editor.addImageLayer(img, file.name.replace(/\.[^.]+$/, '') || 'Image'); done(); } };
        img.onerror = () => { done(); ui.toast('Could not read that image.', 'error'); };
        img.src = url;
    }

    function moreItems(l: Layer): MenuItem[] {
        const i = editor.layers.indexOf(l), below = editor.layers[i - 1];
        return [
            { label: 'Rename', onselect: () => (renaming = l.id) },
            { label: 'Move Up', icon: LArrowUp, disabled: i === editor.layers.length - 1, onselect: () => editor.moveLayer(l, 1) },
            { label: 'Move Down', icon: LArrowDown, disabled: i === 0, onselect: () => editor.moveLayer(l, -1) },
            { label: 'Duplicate', icon: LCopy, onselect: () => editor.duplicateLayer(l) },
            { label: 'Copy Layer', onselect: () => editor.copyLayer(l) },
            { label: 'Paste As New Layer', disabled: !editor.hasClipboard, onselect: () => editor.paste() },
            { label: 'Merge Down', icon: LMerge, disabled: !below || below.isMask !== l.isMask, onselect: () => editor.mergeDown(l) },
            { label: l.isMask ? 'Invert Mask' : 'Invert Colours', onselect: () => editor.invertLayer(l) },
            { label: l.isMask ? 'Convert To Image Layer' : 'Convert To Mask Layer', onselect: () => editor.setLayerProps(l, { isMask: !l.isMask }) },
            { separator: true },
            { label: 'Clear Layer', onselect: () => editor.clearLayer(l) },
            { label: 'Delete Layer', icon: LTrash2, danger: true, disabled: editor.layers.length <= 1, onselect: () => remove([l]) },
        ];
    }
</script>

<div class="layers">
    <Toolbar label="Layer actions">
        <IconButton icon={LPlus} variant="primary" label="New layer" onclick={() => editor.addLayer(false)} />
        <IconButton icon={LVenetianMask} label="New mask layer" onclick={() => editor.addLayer(true)} />
        <IconButton icon={LImagePlus} label="Add image as layer" onclick={() => fileEl?.click()} />
        <IconButton icon={LListChecks} label="Select several layers (or Ctrl / Shift + click)" pressed={multi} onclick={() => (multi = !multi)} />
        <span class="sp"></span>
        <IconButton icon={LMerge} label="Merge selected layers" disabled={!editor.canMergeSelected} onclick={() => editor.mergeSelected()} />
        <IconButton icon={LTrash2} variant="danger" label={selected.length > 1 ? `Delete ${selected.length} layers` : 'Delete layer'} disabled={!active || editor.layers.length <= 1} onclick={() => remove(selected)} />
    </Toolbar>
    <input bind:this={fileEl} type="file" accept="image/*" hidden onchange={importFile} />
    {#if active}
        <Slider label="Opacity" min={0} max={100} step={1} value={Math.round(active.opacity * 100)}
            oninput={(v: number) => { opacityStart ??= active.opacity; editor.setLayerProps(active, { opacity: v / 100 }, false); }}
            onchange={(v: number) => { editor.setLayerProps(active, { opacity: v / 100 }, false); editor.commitOpacity(active, opacityStart ?? active.opacity); opacityStart = null; }} />
    {/if}
    {#if multi || selected.length > 1}<p class="multi">{selected.length} selected{multi ? ', tap layers to add or remove' : ''}</p>{/if}
    <ul class="list" role="listbox" aria-label="Layers" aria-multiselectable="true">
        {#each list as l (l.id)}
            <li class="row" class:on={l.id === editor.activeId} class:sel={isSel(l) && l.id !== editor.activeId} class:hidden={!l.visible} role="option" aria-selected={isSel(l)}>
                <IconButton icon={l.visible ? LEye : LEyeOff} label={l.visible ? 'Hide layer' : 'Show layer'} onclick={() => editor.setLayerProps(l, { visible: !l.visible })} />
                <button type="button" class="pick" onclick={(e) => pick(e, l)} ondblclick={() => (renaming = l.id)}>
                    <canvas class="thumb" class:mask={l.isMask} width="44" height="44" use:thumb={{ layer: l, rev: editor.rev }}></canvas>
                    {#if renaming === l.id}
                        <!-- svelte-ignore a11y_autofocus -->
                        <input class="name-in" value={l.name} aria-label="Layer name" autofocus onclick={(e) => e.stopPropagation()}
                            onblur={(e) => rename(l, e.currentTarget.value)} onkeydown={(e) => { if (e.key === 'Enter') rename(l, e.currentTarget.value); if (e.key === 'Escape') renaming = null; }} />
                    {:else}
                        <span class="name">{l.name}{#if l.isMask}<span class="tag">Mask</span>{/if}</span>
                    {/if}
                </button>
                <Menu items={moreItems(l)} label="Layer options">
                    {#snippet trigger(p)}<IconButton {...p} icon={LEllipsis} label="Layer options" />{/snippet}
                </Menu>
            </li>
        {/each}
    </ul>
</div>

<style>
    .layers { display: flex; flex-direction: column; gap: var(--space-2); min-height: 0; }
    .sp { flex: 1; }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; overflow: auto; min-height: 0; }
    .row { display: flex; align-items: center; gap: var(--space-1); padding: 2px; border-radius: var(--radius-ui); }
    .row.on { background: var(--color-active); }
    .row.sel { background: var(--color-accent-soft); }
    .multi { margin: 0; font-size: var(--text-small); color: var(--color-ink-3); }
    .row.hidden .pick { opacity: 0.55; }
    .pick { all: unset; flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-2); cursor: pointer; border-radius: var(--radius-sm); }
    .pick:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
    .row:not(.on):hover { background: var(--color-hover); }
    .thumb { width: 36px; height: 36px; flex: none; border-radius: var(--radius-sm); box-shadow: 0 0 0 1px var(--color-border-strong);
        background: repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 10px 10px; }
    .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: var(--space-1); }
    .tag { font-size: var(--text-small); padding: 0 4px; border-radius: var(--radius-sm); background: var(--color-accent-soft); color: var(--color-ink-2); }
    .name-in { flex: 1; min-width: 0; font: inherit; color: var(--color-ink); background: var(--color-input); border: 0; border-radius: var(--radius-sm); padding: 2px 4px; box-shadow: var(--edge-field); }
</style>
