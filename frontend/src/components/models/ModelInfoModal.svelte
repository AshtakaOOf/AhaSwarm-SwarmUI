<script lang="ts">
    import LStar from '@lucide/svelte/icons/star';
    import LPlay from '@lucide/svelte/icons/play';
    import LLayers from '@lucide/svelte/icons/layers';
    import LPlus from '@lucide/svelte/icons/plus';
    import LMinus from '@lucide/svelte/icons/minus';
    import LText from '@lucide/svelte/icons/text-cursor-input';
    import LCopy from '@lucide/svelte/icons/copy';
    import LChevronDown from '@lucide/svelte/icons/chevron-down';
    import LPencil from '@lucide/svelte/icons/pencil';
    import LHistory from '@lucide/svelte/icons/history';
    import LFileCode from '@lucide/svelte/icons/file-code';
    import LTextCursor from '@lucide/svelte/icons/text-cursor';
    import LTrash2 from '@lucide/svelte/icons/trash-2';
    import type { ModelInfo } from '../../lib/api/types';
    import { resolveUrl } from '../../lib/api/client';
    import { hasModelPreview, modelPreviewSrc } from '../../lib/state/models';
    import { api, hasPermission } from '../../lib/api/swarm';
    import { browseModelHistory, canBrowseModelHistory } from '../../lib/state/actions';
    import ModelRenameModal from './ModelRenameModal.svelte';
    import ModelHeaderModal from './ModelHeaderModal.svelte';
    import { cleanModelName, paramState } from '../../lib/state/params.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { gen } from '../../lib/state/gen.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { fileToDataUrl } from '../../lib/util/metadata';
    import { modelFacts, stripHtml } from '../../lib/util/modelInfo';
    import { getCivitaiMetadata, imageToData, parseCivitaiUrl, searchCivitaiForHash } from '../../lib/util/civitai';
    import { Button, Dropdown, FormRow, GalleryCard, Icon, ImageInput, KeyValueList, Menu, Modal, TextInput, Textarea, Toggle, copyText, type MenuItem } from '../ui';

    const PREDICTION_TYPES = [
        { value: '', label: 'Unspecified' },
        { value: 'v', label: 'V-Prediction' },
        { value: 'epsilon', label: 'Epsilon' },
        { value: 'x0', label: 'x0' },
        { value: 'lcm', label: 'LCM' },
        { value: 'v-zsnr', label: 'VPred ZSNR' },
        { value: 'sd3', label: 'SD3 (Rectified Flow)' },
    ];
    const CONFINEMENTS = [
        { value: '0', label: 'Global' },
        { value: '5', label: 'Base' },
        { value: '1', label: 'Refiner' },
        { value: '2', label: 'Video' },
        { value: '3', label: 'VideoSwap' },
    ];

    type Props = {
        model: ModelInfo; subtype: string; starred: boolean; active: boolean; actionLabel: string;
        folders?: string[];
        onuse: () => void; onstar: () => void; onclose: () => void; onsearchauthor?: (author: string) => void;
        onreload?: () => void;
        onfileschanged?: () => void;
    };
    let { model: m, subtype, starred, active, actionLabel, folders = [], onuse, onstar, onclose, onsearchauthor, onreload, onfileschanged }: Props = $props();
    let open = $state(true);
    const facts = $derived(modelFacts(m, subtype));
    const name = $derived(cleanModelName(m.name));
    const searchAuthor = $derived(m.author && onsearchauthor ? () => onsearchauthor(`${m.author}`) : undefined);
    function showPreviewAsCurrent() {
        if (!hasModelPreview(m.preview_image)) return;
        gen.setCurrent(m.preview_image, null, 'model');
        onclose();
    }
    const append = (key: string, chunk: string) => paramState.set(key, `${paramState.values[key] ?? ''} ${chunk}`.trim());
    function setRefiner() {
        paramState.set('refinermodel', name);
        if ('refineupscale' in paramState.groupToggles) paramState.groupToggles['refineupscale'] = true;
    }
    const canEdit = $derived(m.local !== false && hasPermission('edit_model_metadata'));
    const canManage = $derived(m.local !== false && hasPermission('delete_models'));
    let renaming = $state(false), viewingHeader = $state(false);
    async function deleteModel() {
        if (!(await ui.ask(`Delete ${m.name}?`, 'The model file is deleted from disk. This cannot be undone.', { confirmLabel: 'Delete' }))) return;
        try {
            await api.deleteModel(m.name, subtype);
            ui.toast(`Deleted ${m.name}.`, 'success');
            onfileschanged?.();
            onclose();
        }
        catch (e) {
            ui.error(e);
        }
    }
    const moreItems = $derived<MenuItem[]>([
        { label: 'Copy path', icon: LCopy, onselect: () => copyText(m.name) },
        ...(m.trigger_phrase ? [{ label: 'Add trigger', icon: LText, onselect: () => append('prompt', `${m.trigger_phrase}`) }] : []),
        ...(subtype === 'LoRA' ? [{ label: 'Add to prompt', icon: LPlus, onselect: () => append('prompt', `<lora:${name}>`) }] : []),
        ...(canBrowseModelHistory(subtype) ? [{ label: 'Browse history', icon: LHistory, onselect: () => { browseModelHistory(subtype, m.name); onclose(); } }] : []),
        ...(canEdit ? [{ label: 'View raw header', icon: LFileCode, onselect: () => (viewingHeader = true) }] : []),
        ...(canManage ? [
            { label: 'Rename', icon: LTextCursor, onselect: () => (renaming = true) },
            { label: 'Delete', icon: LTrash2, danger: true, onselect: deleteModel },
        ] : []),
    ]);
    const actionIcon = $derived(subtype === 'LoRA' ? (active ? LMinus : LPlus) : LPlay);
    const archOptions = $derived(Object.entries(paramState.modelClasses).map(([id, c]: [string, any]) => ({ value: id, label: c.name ?? id })));

    let editing = $state(false);
    let form = $state({
        title: '', author: '', type: '', description: '', usage_hint: '', date: '', license: '', trigger_phrase: '', tags: '', merged_from: '',
        prediction_type: '', resolution: '', is_negative: false, lora_default_weight: '', lora_default_confinement: '', preset: '',
    });
    let civitaiUrl = $state(''), civitaiInfo = $state(''), hash = $state('');
    let preview = $state<string | null>(null), previewChanged = $state(false);
    const previewSrc = $derived(preview === 'clear' ? '' : (preview ?? (hasModelPreview(m.preview_image) ? resolveUrl(m.preview_image) : '')));
    const presetOptions = $derived([{ value: '', label: '(None)' }, ...presetState.all.map(p => ({ value: p.title, label: p.title }))]);
    function startEdit() {
        form = {
            title: m.title || m.name, author: m.author ?? '', type: m.architecture ?? '', description: m.description ?? '', usage_hint: m.usage_hint ?? '',
            date: m.date ?? '', license: m.license ?? '', trigger_phrase: m.trigger_phrase ?? '', tags: (m.tags ?? []).join(', '), merged_from: m.merged_from ?? '',
            prediction_type: m.prediction_type ?? '', resolution: m.standard_width ? `${m.standard_width}x${m.standard_height}` : '',
            is_negative: !!m.is_negative_embedding, lora_default_weight: m.lora_default_weight ?? '', lora_default_confinement: m.lora_default_confinement ?? '',
            preset: presetState.userData?.model_preset_links?.[subtype]?.[cleanModelName(m.name)]?.[0] ?? '',
        };
        civitaiUrl = '';
        civitaiInfo = '';
        hash = m.hash ?? '';
        preview = null;
        previewChanged = false;
        editing = true;
    }
    async function loadHash() {
        try {
            hash = (await api.getModelHash(m.name, subtype)).hash;
        }
        catch (e) {
            ui.error(e);
        }
    }
    async function loadCivitai() {
        civitaiInfo = 'Loading…';
        let url = civitaiUrl.trim();
        if (!url) {
            civitaiInfo = 'Loading hash…';
            const h = hash || m.hash || (await api.getModelHash(m.name, subtype)).hash;
            hash = h;
            civitaiInfo = 'Hash loaded, searching Civitai…';
            url = (await searchCivitaiForHash(h)) ?? '';
            if (!url) { civitaiInfo = 'No Civitai URL found for this model hash.'; return; }
            civitaiUrl = url;
        }
        const [id, vid] = parseCivitaiUrl(url);
        if (!id && !vid) { civitaiInfo = 'Invalid URL.'; return; }
        civitaiInfo = 'Loading…';
        const r = await getCivitaiMetadata(id, vid, { validateSafe: false });
        if ('error' in r) { civitaiInfo = `Failed to load metadata. ${r.error}`; return; }
        const md = r.metadata;
        form.title = md['modelspec.title'] ?? '';
        if (md['modelspec.author']) form.author = md['modelspec.author'];
        if (md['modelspec.description']) form.description = md['modelspec.description'];
        if (md['modelspec.date']) form.date = md['modelspec.date'];
        if (md['modelspec.trigger_phrase']) form.trigger_phrase = md['modelspec.trigger_phrase'];
        if (md['modelspec.usage_hint']) form.usage_hint = md['modelspec.usage_hint'];
        if (md['modelspec.tags']) form.tags = md['modelspec.tags'];
        if (r.imgUrls[0]) {
            const img = await imageToData(r.imgUrls[0]);
            if (img) { preview = img; previewChanged = true; }
        }
        civitaiInfo = 'Loaded.';
    }
    async function onPreview(files: File[]) {
        if (!files[0]) return;
        preview = await imageToData(await fileToDataUrl(files[0]), true);
        previewChanged = true;
    }
    async function save() {
        const [w, h] = form.resolution.split('x').map(Number);
        const arch = m.architecture || '';
        try {
            await api.editModelMetadata({
                model: m.name, subtype, title: form.title, author: form.author, type: form.type, description: form.description,
                standard_width: w || 0, standard_height: h || 0, date: form.date, license: form.license,
                trigger_phrase: form.trigger_phrase, usage_hint: form.usage_hint, prediction_type: form.prediction_type,
                tags: form.tags || null,
                preview_image: previewChanged ? (preview === 'clear' ? 'clear' : preview) : '',
                preview_image_metadata: preview === 'clear' ? undefined : (gen.current?.metadata ?? null),
                is_negative_embedding: arch.endsWith('/textual-inversion') ? form.is_negative : false,
                lora_default_weight: arch.endsWith('/lora') ? form.lora_default_weight : '',
                lora_default_confinement: arch.endsWith('/lora') ? form.lora_default_confinement : '',
            });
            const links = { ...(presetState.userData?.model_preset_links ?? {}) };
            links[subtype] ??= {};
            if (form.preset) links[subtype][cleanModelName(m.name)] = [form.preset];
            else delete links[subtype][cleanModelName(m.name)];
            await api.setPresetLinks(links);
            if (presetState.userData) presetState.userData.model_preset_links = links;
            ui.toast('Model metadata saved.', 'success');
            editing = false;
            onreload?.();
            onclose();
        }
        catch (e) {
            ui.error(e);
        }
    }
</script>

<Modal bind:open tone="panel" title={m.title || name.split('/').pop()} subtitle={m.author ? `by ${m.author}` : undefined} onsubtitleclick={searchAuthor} size="lg" onclose={onclose}>
    <div class="mi">
        <div class="pv">
            <GalleryCard src={modelPreviewSrc(m.preview_image)} placeholder="No preview" alt={hasModelPreview(m.preview_image) ? `Set ${m.title || name} as current image` : m.title || name} aspect="auto" fit="contain"
                onclick={hasModelPreview(m.preview_image) ? showPreviewAsCurrent : undefined} />
        </div>
        <div class="facts">
            <KeyValueList label="Model details" items={facts} />
            {#if m.description}<p class="desc">{stripHtml(m.description)}</p>{/if}
        </div>
    </div>
    {#snippet footer()}
        <Button icon={LStar} fill={starred ? 'currentColor' : 'none'} aria-pressed={starred} onclick={onstar}>{starred ? 'Unstar' : 'Star'}</Button>
        {#if subtype === 'Stable-Diffusion'}<Button icon={LLayers} onclick={setRefiner}>Set as refiner</Button>{/if}
        {#if subtype === 'Embedding'}
            <Button icon={LPlus} onclick={() => append('prompt', `<embed:${name}>`)}>Add to prompt</Button>
            <Button icon={LMinus} onclick={() => append('negativeprompt', `<embed:${name}>`)}>Add to negative</Button>
        {/if}
        {#if canEdit}<Button icon={LPencil} onclick={startEdit}>Edit</Button>{/if}
        {#if moreItems.length}
            <Menu items={moreItems} label="More model actions">
                {#snippet trigger(p)}<Button {...p}>More <Icon icon={LChevronDown} /></Button>{/snippet}
            </Menu>
        {/if}
        {#if actionLabel}<Button variant={active && subtype !== 'Stable-Diffusion' && subtype !== 'VAE' ? 'danger' : 'primary'} icon={actionIcon} onclick={() => { onuse(); if (subtype === 'Stable-Diffusion' || subtype === 'VAE') open = false; }}>{actionLabel}</Button>{/if}
    {/snippet}
</Modal>

<Modal bind:open={editing} tone="panel" title="Edit model metadata" size="lg" onclose={() => (editing = false)}>
    <div class="edit-form ui-dense">
        <div class="hash-row">
            <span class="aha-muted">Hash: {hash || '(Not available)'}</span>
            <Button onclick={loadHash}>Load Hash</Button>
        </div>
        <FormRow label="Load from Civitai">
            <div class="civ-load">
                <TextInput bind:value={civitaiUrl} placeholder="Civitai URL (or blank to use hash)" />
                <Button onclick={loadCivitai}>Load</Button>
            </div>
        </FormRow>
        {#if civitaiInfo}<p class="aha-muted">{civitaiInfo}</p>{/if}
        <hr class="divider" />
        <FormRow label="Image">
            <ImageInput src={previewSrc} onfiles={onPreview} onclear={() => { preview = 'clear'; previewChanged = true; }} />
        </FormRow>
        <FormRow label="Title"><TextInput bind:value={form.title} placeholder="Display name shown in the model browser." /></FormRow>
        <FormRow label="Author"><TextInput bind:value={form.author} placeholder="Creator of the model." /></FormRow>
        <FormRow label="Architecture"><Dropdown ariaLabel="Architecture" options={archOptions} bind:value={form.type} searchable /></FormRow>
        <FormRow label="Prediction type"><Dropdown ariaLabel="Prediction type" options={PREDICTION_TYPES} bind:value={form.prediction_type} /></FormRow>
        <FormRow label="Standard resolution"><TextInput bind:value={form.resolution} placeholder="1024x1024" /></FormRow>
        <FormRow label="License"><TextInput bind:value={form.license} placeholder="License name or link." /></FormRow>
        <FormRow label="Date"><TextInput bind:value={form.date} placeholder="MM/DD/YYYY HH:MM:SS" /></FormRow>
        <FormRow label="Merged from"><TextInput bind:value={form.merged_from} placeholder="Model merged from." /></FormRow>
        <FormRow label="Tags"><TextInput bind:value={form.tags} placeholder="Comma-separated tags." /></FormRow>
        <FormRow label="Usage hint"><TextInput bind:value={form.usage_hint} placeholder="Short note on how to use the model." /></FormRow>
        <FormRow label="Trigger phrase"><TextInput bind:value={form.trigger_phrase} placeholder="Words that activate the model, separated by ;." /></FormRow>
        {#if (m.architecture || '').endsWith('/textual-inversion')}
            <FormRow label="Negative embedding"><Toggle hideLabel label="Negative embedding" bind:checked={form.is_negative} /></FormRow>
        {/if}
        <FormRow label="Description"><Textarea rows={2} maxRows={6} bind:value={form.description} placeholder="Description shown in the model info popup." /></FormRow>
        {#if (m.architecture || '').endsWith('/lora')}
            <hr class="divider" />
            <FormRow label="LoRA default weight"><TextInput type="number" min={-10} max={10} step={0.05} bind:value={form.lora_default_weight} /></FormRow>
            <FormRow label="LoRA default confinement"><Dropdown ariaLabel="LoRA default confinement" options={CONFINEMENTS} bind:value={form.lora_default_confinement} /></FormRow>
        {/if}
        <FormRow label="Linked preset"><Dropdown ariaLabel="Linked preset" options={presetOptions} bind:value={form.preset} /></FormRow>
    </div>
    {#snippet footer()}
        <Button onclick={() => (editing = false)}>Cancel</Button>
        <Button variant="primary" onclick={save}>Save</Button>
    {/snippet}
</Modal>

{#if renaming}
    <ModelRenameModal model={m} {subtype} {folders} onrenamed={() => { renaming = false; onfileschanged?.(); onclose(); }} onclose={() => (renaming = false)} />
{/if}
{#if viewingHeader}
    <ModelHeaderModal model={m} {subtype} onclose={() => (viewingHeader = false)} />
{/if}

<style>
    .mi { display: flex; gap: var(--space-3); align-items: flex-start; min-width: 0; }
    .edit-form { display: flex; flex-direction: column; gap: var(--space-1); }
    .edit-form :global(.aha-frow > .lbl) { flex-basis: 150px; white-space: nowrap; }
    /* the textarea fills its row (no 2px vertical centring), so add the missing top gap before it */
    .edit-form :global(.aha-frow:has(textarea)) { margin-top: 2px; }
    .edit-form :global(.aha-frow > .image-input) { flex: none; }
    .divider { border: 0; border-top: 1px solid var(--color-hover); margin: var(--space-1) 0; }
    .edit-form :global(.aha-frow > .ctl), .edit-form :global(.aha-frow > .ui-ta) { background: var(--color-input); color: var(--color-ink); }
    .edit-form :global(.aha-frow > .ctl:hover), .edit-form :global(.aha-frow > .ctl:focus), .edit-form :global(.aha-frow > .ui-ta:hover), .edit-form :global(.aha-frow > .ui-ta:focus) { background: var(--color-input-hover); }
    .hash-row { display: flex; align-items: center; gap: var(--space-2); }
    .hash-row .aha-muted { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .civ-load { display: flex; gap: var(--space-1); align-items: center; }
    .civ-load > :global(input.ctl) { flex: 1; }

    .pv { flex: 0 0 220px; min-width: 0; }
    .facts { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .desc { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--color-ink-2); font-size: var(--text-ui); line-height: 1.5; }
    @container (max-width: 560px) { .mi { flex-direction: column; } .pv { flex: none; width: 100%; } }
    @media (max-width: 560px) { .mi { flex-direction: column; } .pv { flex: none; width: 100%; } }
</style>
