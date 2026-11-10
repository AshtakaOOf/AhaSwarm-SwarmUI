<script lang="ts">
    import LEraserP from '@lucide/svelte/icons/eraser';
    import LRefreshP from '@lucide/svelte/icons/refresh-cw';
    import LPencilP from '@lucide/svelte/icons/pencil';
    import LTrashP from '@lucide/svelte/icons/trash-2';
    import LXP from '@lucide/svelte/icons/x';
    import LPlus from '@lucide/svelte/icons/plus';
    import LStar from '@lucide/svelte/icons/star';
    import LTriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import { api } from '../../lib/api/swarm';
    import type { Preset } from '../../lib/api/types';
    import { resolveUrl } from '../../lib/api/client';
    import { mediaType } from '../../lib/util/metadata';
    import { paramState } from '../../lib/state/params.svelte';
    import { gen } from '../../lib/state/gen.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import LCheckP from '@lucide/svelte/icons/check';
    import { Badge, Button, Dropdown, EmptyState, IconButton, Modal, VirtualGrid, TextInput, Textarea, Toggle, type KeyValue } from '../ui';
    import { FORMAT_OPTIONS, formatClass, labelFit, formatLayout, isListFormat, loadFormat, saveFormat } from '../../lib/util/browserFormat';
    import BrowserCard from '../browser/BrowserCard.svelte';
    import BrowserSkeleton from '../browser/BrowserSkeleton.svelte';

    let loading = $state(!presetState.loaded);
    let error = $state<string | null>(null);
    let search = $state('');
    let createOpen = $state(false);
    let title = $state('');
    let description = $state('');
    let editing = $state<Preset | null>(null);
    let useCurrentImage = $state(true);
    let include = $state<Record<string, boolean>>({});
    let candidate = $state<Record<string, any>>({});

    async function load() {
        loading = true;
        try {
            await presetState.load();
            error = null;
        }
        catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
        loading = false;
    }
    if (!presetState.loaded) {
        load();
    }

    let format = $state(loadFormat('presets', 'Cards'));
    function setFormat(v: string) { format = v as typeof format; saveFormat('presets', v); }
    const isCards = $derived(format.includes('Cards'));

    function valueText(v: any): string {
        const t = Array.isArray(v) ? v.join(', ') : `${v}`;
        return t.length > 80 ? `${t.slice(0, 79)}…` : t;
    }
    function presetFacts(p: Preset): KeyValue[] {
        return Object.entries(p.param_map ?? {}).map(([k, v]) => ({ key: paramState.byId[k]?.name ?? k, value: valueText(v) }));
    }
    function paramSummary(p: Preset): string {
        return Object.keys(p.param_map ?? {}).map(k => paramState.byId[k]?.name ?? k).join(', ');
    }

    const shown = $derived(presetState.all.filter(p => !search || `${p.title} ${p.description}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => Number(!!b.is_starred) - Number(!!a.is_starred)));

    function directApply(p: Preset) {
        const n = presetState.applyOne(p);
        ui.toast(`Applied preset "${p.title}" (${n} params).`, 'success');
    }

    function openCreate(p: Preset | null = null) {
        editing = p;
        title = p?.title ?? '';
        description = p?.description ?? '';
        useCurrentImage = !p;
        const input = paramState.buildInput();
        delete input['extra_metadata'];
        delete input['presets'];
        if (p) {
            candidate = { ...input, ...p.param_map };
            include = Object.fromEntries(Object.keys(candidate).map(k => [k, k in p.param_map]));
        }
        else {
            candidate = input;
            include = Object.fromEntries(Object.keys(input).map(k => {
                const param = paramState.byId[k];
                const changed = !!param && `${input[k]}` !== `${param.default}`;
                return [k, changed && k !== 'seed' && k !== 'images' && !(typeof input[k] === 'string' && input[k].startsWith('data:'))];
            }));
        }
        createOpen = true;
    }
    const candidateKeys = $derived(Object.keys(candidate).filter(k => paramState.byId[k]));

    async function save() {
        if (!title.trim()) {
            ui.toast('A preset needs a title.', 'warning');
            return;
        }
        const map: Record<string, any> = {};
        for (const k of candidateKeys) {
            if (include[k]) {
                map[k] = candidate[k];
            }
        }
        let previewImage: string | undefined;
        if (useCurrentImage && gen.current && mediaType(gen.current.src) === 'image') {
            previewImage = await smallJpegPreview(resolveUrl(gen.current.src)).catch(() => undefined);
        }
        else if (editing?.preview_image && (editing.preview_image.startsWith('data:image/jpeg;base64,') || editing.preview_image.startsWith('/Output'))) {
            previewImage = editing.preview_image;
        }
        try {
            const res = await api.addNewPreset(title.trim(), description, map, { previewImage, isEdit: !!editing, editing: editing?.title, isStarred: !!editing?.is_starred });
            if (res.preset_fail) {
                ui.toast(res.preset_fail, 'error');
                return;
            }
            ui.toast('Preset saved.', 'success');
            createOpen = false;
            load();
        }
        catch (e) {
            ui.error(e);
        }
    }

    async function del(p: Preset) {
        if (!confirm(`Delete preset "${p.title}"?`)) {
            return;
        }
        try {
            await api.deletePreset(p.title);
            load();
        }
        catch (e) {
            ui.error(e);
        }
    }

    function smallJpegPreview(url: string, size = 256): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('no canvas')); return; }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => reject(new Error('preview load failed'));
            img.src = url;
        });
    }
</script>

<div class="page">
    <div class="top">
        <div class="grow"><TextInput type="search" placeholder="Search presets…" aria-label="Search presets" bind:value={search} /></div>
        <Button variant="primary" icon={LPlus} onclick={() => openCreate()}>Create New</Button>
        <Button disabled={!presetState.current.length} onclick={() => ui.toast(`Applied ${presetState.applyAll()} preset params.`, 'success')}>Apply</Button>
        <Button variant="danger" icon={LEraserP} disabled={!presetState.current.length} onclick={() => presetState.clear()}>Clear current</Button>
        <Button icon={LRefreshP} onclick={load}>Refresh</Button>
        <div class="sel"><Dropdown ariaLabel="Display format" options={FORMAT_OPTIONS} value={format} onchange={setFormat} /></div>
    </div>
    <div class="list">
        {#if loading}
            <BrowserSkeleton {format} label="Loading presets" />
        {:else if error}
            <EmptyState icon={LTriangleAlert} title="Couldn't load presets" message={error} />
        {:else if !shown.length}
            <EmptyState icon={LStar} title="No presets yet" message="Set up parameters, then save them as a preset.">
                <Button variant="primary" icon={LPlus} onclick={() => openCreate()}>Create New</Button>
            </EmptyState>
        {:else}
            <p>Click a preset to add or remove it from the current presets. Current presets are applied at generate time.</p>
            <VirtualGrid items={shown} key={(p: Preset) => p.title} {...formatLayout(format)} class={formatClass(format)} label="Presets">
                {#snippet item(p: Preset)}
                    <BrowserCard labelFit={labelFit(format)} src={resolveUrl(p.preview_image)} title={p.title} subtitle={p.author ? `by ${p.author}` : ''}
                        facts={isCards ? presetFacts(p) : []} description={p.description} cols={[p.description, paramSummary(p)]}
                        selected={presetState.isCurrent(p.title)} onclick={() => presetState.toggle(p.title)}
                        ontileclick={(e: MouseEvent) => { if (isListFormat(format) && !(e.target as HTMLElement).closest('button, a, .desc')) presetState.toggle(p.title); }}>
                        {#snippet extra()}
                            {#if p.is_starred}<Badge label="Starred" tone="info" />{/if}
                        {/snippet}
                        {#snippet actions()}
                            {#if format === 'Small Cards'}
                                <IconButton variant="default" icon={LCheckP} label="Direct apply {p.title}" onclick={() => directApply(p)} />
                                <IconButton variant="default" icon={LPencilP} label="Edit {p.title}" onclick={() => openCreate(p)} />
                                <IconButton variant="danger" icon={LTrashP} label="Delete {p.title}" onclick={() => del(p)} />
                            {:else}
                                <Button icon={LCheckP} onclick={() => directApply(p)}>Direct Apply</Button>
                                <Button icon={LPencilP} onclick={() => openCreate(p)}>Edit</Button>
                                <Button variant="danger" icon={LTrashP} onclick={() => del(p)}>Delete</Button>
                            {/if}
                        {/snippet}
                        {#snippet overlay()}
                            {#if !isCards}
                                <IconButton icon={LCheckP} label="Direct apply {p.title}" onclick={() => directApply(p)} />
                                <IconButton icon={LPencilP} label="Edit {p.title}" onclick={() => openCreate(p)} />
                                <IconButton icon={LTrashP} variant="danger" label="Delete {p.title}" onclick={() => del(p)} />
                            {/if}
                        {/snippet}
                    </BrowserCard>
                {/snippet}
            </VirtualGrid>
        {/if}
    </div>
</div>

<Modal bind:open={createOpen} title={editing ? `Edit preset "${editing.title}"` : 'Create new preset'} size="lg">
    <div class="form">
        <TextInput label="Title" hint="Use a/b to put it in a folder." bind:value={title} />
        <Textarea label="Description" rows={2} bind:value={description} />
        <Toggle label={editing ? 'Replace preview with the current image' : 'Use the current image as the preview'} bind:checked={useCurrentImage} />
        <p>Parameters to include (text values may use <code>{'{value}'}</code> to wrap the current value):</p>
        <div class="params">
            {#each candidateKeys as k (k)}
                <div class="prow">
                    <Toggle label={paramState.byId[k]?.name ?? k} bind:checked={include[k]} />
                    <span class="pval">{Array.isArray(candidate[k]) ? candidate[k].join(', ') : `${candidate[k]}`.slice(0, 120)}</span>
                </div>
            {/each}
        </div>
    </div>
    {#snippet footer()}
        <Button icon={LXP} onclick={() => (createOpen = false)}>Cancel</Button>
        <Button variant="primary" onclick={save}>Save preset</Button>
    {/snippet}
</Modal>

<style>
    .page { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .top { display: flex; gap: var(--space-2); align-items: center; padding: var(--space-2) var(--space-2); flex-wrap: wrap; }
    /* fixed-width search (same as History): toggling other controls never resizes it or shifts the row */
    .grow { flex: 0 1 240px; min-width: 160px; }
    .sel { flex: 0 0 auto; min-width: 150px; }
    .list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 var(--space-2) var(--space-3); }
    .form { display: flex; flex-direction: column; gap: var(--space-2); }
    .params { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-1) var(--space-3); max-height: 50vh; overflow-y: auto; }
    .prow { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
    .pval { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
