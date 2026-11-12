<script lang="ts">
    import LXI from '@lucide/svelte/icons/x';
    import LCopy from '@lucide/svelte/icons/copy';
    import LDices from '@lucide/svelte/icons/dices';
    import LStar from '@lucide/svelte/icons/star';
    import type { T2IParam } from '../../lib/api/types';
    import { paramState, defaultFor } from '../../lib/state/params.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { fileToDataUrl, parseMetadata } from '../../lib/util/metadata';
    import { gen } from '../../lib/state/gen.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import Recycle from '@lucide/svelte/icons/recycle';
    import LRotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import { Badge, InfoButton, Toggle, Slider, NumberInput, TextInput, Textarea, Dropdown, Button, IconButton, Field, GalleryCard, FileInput } from '../ui';

    type Store = { values: Record<string, any>; toggles: Record<string, boolean>; set: (id: string, v: any) => void };
    let { param, store }: { param: T2IParam; store?: Store } = $props();
    const st = $derived<Store>(store ?? paramState);
    const id = $derived(`p-${param.id}`);
    const changed = $derived(`${st.values[param.id]}` !== `${defaultFor(param)}`);
    const isMedia = $derived(['image', 'image_list', 'audio', 'audio_list', 'video', 'video_list'].includes(param.type));

    const options = $derived.by(() => {
        if (param.type === 'model' && !(param.values && param.values.length)) {
            return (paramState.models[param.subtype || 'Stable-Diffusion'] ?? []).map(m => ({ value: m[0], label: m[0] }));
        }
        return (param.values ?? []).map((v, i) => ({ value: v, label: param.value_names?.[i] || v }));
    });
    // classic keeps an unknown saved value selectable, marked "(Invalid)", instead of silently swapping it
    const dropdownOptions = $derived.by(() => {
        const v = st.values[param.id];
        if (v == null || v === '' || options.some(o => o.value === v)) {
            return options;
        }
        return [{ value: `${v}`, label: `${v} (Invalid)` }, ...options];
    });

    function setVal(v: any) {
        st.set(param.id, v);
    }
    const num = $derived(Number(st.values[param.id] ?? 0));
    const nmin = $derived(param.min || param.min === 0 ? param.min : -9999999);
    const nmax = $derived(param.max || param.max === 0 ? param.max : 9999999);
    const smin = $derived(nmin);
    const smax = $derived(nmax);
    const isPot = $derived(param.view_type === 'pot_slider');
    const vmin = $derived(param.view_min || smin);
    const vmax = $derived(param.view_max || smax);
    function reuseFromCurrent() {
        const meta = parseMetadata(gen.current?.metadata ?? null);
        const v = meta?.params?.[param.id];
        if (v === undefined) {
            ui.toast(`The current image has no ${param.name}.`, 'warning');
            return;
        }
        setVal(v);
    }

    async function onFiles(files: File[]) {
        const f = files[0];
        if (!f) {
            return;
        }
        const data = await fileToDataUrl(f);
        if (!param.type.startsWith('image')) {
            setVal({ data, filename: f.name });
            return;
        }
        const img = new Image();
        img.onload = () => setVal({ data, filename: f.name, resolution: `${img.naturalWidth}x${img.naturalHeight}` });
        img.onerror = () => setVal({ data, filename: f.name });
        img.src = data;
    }

    const plainDesc = $derived((param.description || 'No description.').replace(/<[^>]+>/g, '').trim());
    let infoOpen = $state(false);
    const starred = $derived(paramState.isStarred(param.id));

    function toggleListValue(v: string) {
        const cur: string[] = [...(st.values[param.id] ?? [])];
        const i = cur.indexOf(v);
        if (i >= 0) {
            cur.splice(i, 1);
        }
        else {
            cur.push(v);
        }
        setVal(cur);
    }
    const isChoice = $derived(param.type === 'dropdown' || param.type === 'model');
    const stack = $derived(isMedia || (!isChoice && (param.view_type === 'prompt' || param.view_type === 'big')) || (param.type === 'list' && !!param.values));

    function rowClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, label, [role="switch"], [role="button"], .ctrl')) {
            return;
        }
        const control = document.getElementById(id);
        if (!control) {
            return;
        }
        control.focus();
        if (control.matches('button, [role="switch"], [role="button"], [role="combobox"]')) {
            control.click();
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (row click is a pointer shortcut to the control, which has its own keyboard access) -->
<div class="param" class:stack class:bool={param.type === 'boolean'} class:off={param.toggleable && !st.toggles[param.id]} data-param={param.id}
    onclick={rowClick}
    onfocusin={(e: FocusEvent) => { if (param.toggleable && !st.toggles[param.id] && !(e.target as HTMLElement).closest('.label, .enable')) { st.toggles[param.id] = true; } }}>
    <div class="label" role="group" oncontextmenu={(e: MouseEvent) => { e.preventDefault(); infoOpen = true; }}>
        <Field label={param.name} forId={id}>{#snippet children()}{/snippet}</Field>
        <InfoButton bind:open={infoOpen} label={param.name}>
            <div class="ui-dense mb-2 flex flex-wrap gap-1">
                {#if !store}<Button icon={LStar} fill={starred ? 'currentColor' : 'none'} onclick={() => { infoOpen = false; paramState.toggleStarParam(param.id).catch(e => ui.error(e)); }}>{starred ? 'Unstar' : 'Star'}</Button>{/if}
                <Button icon={LRotateCcw} disabled={!changed} onclick={() => { infoOpen = false; st.values[param.id] = defaultFor(param); }}>Reset</Button>
                <Button icon={LCopy} onclick={() => { infoOpen = false; navigator.clipboard?.writeText(param.id); }}>Copy ID</Button>
            </div>
            {#each plainDesc.split('\n').filter(Boolean) as line}<p>{line}</p>{/each}
        </InfoButton>
        {#if !store && presetState.overrides[param.id]}
            {@const o = presetState.overrides[param.id]}
            <Badge label="preset" tone="info" title="overridden by preset{o.names.length > 1 ? 's' : ''} {o.names.join(', ')}: {Array.isArray(o.value) ? o.value.join(', ') : o.value}" />
        {/if}
    </div>

    <div class="ctrl">
        {#if param.toggleable && param.type !== 'boolean'}
            <span class="enable"><Toggle hideLabel label="Enable {param.name}" title="Enable {param.name}" checked={!!st.toggles[param.id]} onchange={(c: boolean) => (st.toggles[param.id] = c)} /></span>
        {/if}
        <div class="body">
    {#if param.type === 'boolean'}
        <Toggle {id} hideLabel label={param.name} checked={!!st.values[param.id]} onchange={(c: boolean) => setVal(c)} />
    {:else if param.type === 'integer' || param.type === 'decimal'}
        {#if param.view_type === 'seed'}
            <div class="row seed">
                <div class="grow"><NumberInput {id} steppers={false} min={nmin} max={nmax} step={param.step || 1} value={num} onchange={(v: number) => setVal(v)} /></div>
                <IconButton variant="default" icon={LDices} label="Random seed (-1)" onclick={() => setVal(-1)} />
                {#if !store}<IconButton variant="default" label="Reuse the {param.name} from the current image" disabled={!gen.current} onclick={reuseFromCurrent} icon={Recycle} />{/if}
            </div>
        {:else if param.view_type === 'slider' || param.view_type === 'pot_slider'}
            <Slider {id} min={smin} max={smax} viewMin={vmin} viewMax={vmax} scale={isPot ? 'pot' : 'linear'}
                defaultValue={Number(defaultFor(param))} step={param.step || 1} value={num}
                oninput={(v: number) => setVal(v)} onchange={(v: number) => setVal(v)} />
        {:else}
            <NumberInput {id} min={nmin} max={nmax} step={param.step || 1}
                defaultValue={Number(defaultFor(param))} value={num} onchange={(v: number) => setVal(v)} />
        {/if}
    {:else if isChoice}
        <div class="row">
            <div class="grow"><Dropdown {id} searchable={param.type === 'model' || options.length > 6 ? true : undefined} ariaLabel={param.name} options={dropdownOptions} value={st.values[param.id]} placeholder="(none)" onchange={(v: string) => setVal(v)} /></div>
            {#if param.id === 'aspectratio' && st.values['aspectratio'] === 'Custom'}
                <Button title="Swap the width and the height" onclick={() => paramState.swapResolution()}>⇆</Button>
            {/if}
        </div>
    {:else if param.type === 'list' && param.values}
        <div class="wrap" role="group" aria-label={param.name}>
            {#each options as o (o.value)}
                <Button aria-pressed={(st.values[param.id] ?? []).includes(o.value)} onclick={() => toggleListValue(o.value)}>{o.label}</Button>
            {/each}
        </div>
    {:else if isMedia}
        {@const v = st.values[param.id]}
        {#if v?.data && param.type.startsWith('image')}
            <div class="thumb"><GalleryCard src={v.data} alt="{param.name} input" caption="{v.filename} {v.resolution ?? ''}" fit="contain" /></div>
        {/if}
        <div class="row">
            <div class="grow">
                <FileInput compact accept={param.type.startsWith('audio') ? 'audio/*' : param.type.startsWith('video') ? 'video/*' : 'image/*'}
                    label={v?.data ? `Replace ${v.filename ?? ''}` : 'Drop or choose a file'} onfiles={onFiles} />
            </div>
            {#if v?.data}<Button variant="danger" icon={LXI} onclick={() => (st.values[param.id] = null)}>Clear</Button>{/if}
        </div>
    {:else if param.view_type === 'prompt' || param.view_type === 'big'}
        <Textarea {id} rows={param.view_type === 'prompt' ? 2 : 1} value={`${st.values[param.id] ?? ''}`} oninput={(v: string) => setVal(v)} />
    {:else}
        <TextInput {id} placeholder={param.examples?.[0] ?? ''}
            value={Array.isArray(st.values[param.id]) ? st.values[param.id].join(',') : `${st.values[param.id] ?? ''}`}
            oninput={(v: string) => setVal(v)} />
    {/if}
        </div>
    </div>
</div>

<style>
    .param { display: flex; flex-wrap: wrap; align-items: center; gap: 0 var(--space-1); padding: 0; min-width: 0; cursor: pointer; }
    .param:has(.label:hover) .body > :global(.ctl),
    .param:has(.label:hover) .body > .row > .grow > :global(.ctl) { background: var(--color-hover); }
    .param:has(.label:hover) .body > :global(.ui-num),
    .param:has(.label:hover) .body > .row.seed > .grow > :global(.ui-num) { background: var(--color-control-hover); }
    .param:has(.label:hover) .body > :global(.ui-ta) { background: var(--color-hover); }
    .param:has(.label:hover) .body > .row > .grow > :global(.ui-drop) { background: var(--color-control-hover); color: var(--color-text); }
    .param:has(.label:hover) .body > :global(.ui-toggle) :global(.thumb) { background: var(--color-text); --thumb-scale: 1.15; }
    .param:has(.label:hover) .body > :global(.ui-toggle[aria-checked='true']) :global(.thumb) { background: var(--color-on-accent); }
    .param:has(.label:hover) .body > :global(.ui-slider) :global(.ui-num) { background: var(--color-control-hover); }
    .param.bool .label { flex: 1 1 0; }
    .param.bool .ctrl { flex: none; display: flex; }
    @container params (max-width: 339px) {
        .param:not(.bool):not(.stack) .label { flex: 1 1 0; }
        .param:not(.bool):not(.stack) .ctrl { flex: 1 0 100%; padding-top: 2px; }
    }
    .label { flex: 0 0 45%; min-width: 0; display: flex; align-items: center; gap: var(--space-1); overflow: hidden; }
    /* only the name shrinks/truncates; info button and badges keep their size and never overlap the control */
    .label > :global(*) { flex: none; }
    .label > :global(:first-child) { flex: 0 1 auto; min-width: 0; overflow: hidden; }
    .ctrl > .enable { flex: none; display: flex; }
    .ctrl > .body { flex: 1; min-width: 0; }
    .param.off .body { opacity: 0.4; filter: grayscale(1); transition: opacity 120ms; }
    .param.off .body :global(.range::-webkit-slider-thumb) { transform: none !important; box-shadow: none !important; }
    .param.off .body:hover { opacity: 0.55; }
    .label :global(label) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .label :global(.inline-flex) { min-width: 0; }
    .ctrl { flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: var(--space-1); }
    .param.stack .label { flex: 1 1 0; }
    .param.stack .ctrl { flex: 1 0 100%; order: 10; padding-top: 2px; }
    .row { display: flex; align-items: center; gap: 2px; }
    .row.seed { gap: var(--space-1); }
    .grow { flex: 1; min-width: 0; }
    .wrap { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .thumb { width: 120px; }
</style>
