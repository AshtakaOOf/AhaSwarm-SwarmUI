<script lang="ts">
    import LWorkflow from '@lucide/svelte/icons/workflow';
    import LArrowLeft from '@lucide/svelte/icons/arrow-left';
    import LX from '@lucide/svelte/icons/x';
    import LSparkles from '@lucide/svelte/icons/sparkles';
    import LTrash from '@lucide/svelte/icons/trash-2';
    import LSearch from '@lucide/svelte/icons/search';
    import { untrack } from 'svelte';
    import { api } from '../../lib/api/swarm';
    import { resolveUrl } from '../../lib/api/client';
    import { ui } from '../../lib/state/ui.svelte';
    import { FORMAT_OPTIONS, formatClass, labelFit, loadFormat, saveFormat } from '../../lib/util/browserFormat';
    import ParamInput from '../params/ParamInput.svelte';
    import { AudioPlayer, Button, Dropdown, EmptyState, GalleryCard, VideoPlayer, IconButton, ParamGroup, ProgressPair, Skeleton, TextInput, Toggle } from '../ui';
    import BrowserCard from '../browser/BrowserCard.svelte';
    import BrowserSkeleton from '../browser/BrowserSkeleton.svelte';

    type WF = { name: string; image?: string; description?: string; enable_in_simple?: boolean };
    let workflows = $state<WF[]>([]), err = $state<string | null>(null), loading = $state(true), search = $state(''), folder = $state('');
    let format = $state(loadFormat('simple', 'Big Thumbnails'));
    let selected = $state<WF | null>(null);
    let wf = $state<{ prompt: string; custom: string } | null>(null);
    let params = $state<any[]>([]);
    let values = $state<Record<string, any>>({}), toggles = $state<Record<string, boolean>>({});
    let groupOn = $state<Record<string, boolean>>({});
    let running = $state(false), progress = $state<{ cur: number; all: number } | null>(null), preview = $state<string | null>(null);
    type Entry = { src: string; loading?: boolean };
    let current = $state<string | null>(null), batch = $state<Entry[]>([]);
    let sock: { close?: () => void } | null = null;
    const store = { values, toggles, set: (id: string, v: any) => { values[id] = v; toggles[id] = true; if (selected) sessionStorage.setItem(key(selected.name, id), JSON.stringify(v instanceof Object && v?.data ? null : v)); } };

    if (!(globalThis as any).__ahaSimpleVisited) {
        (globalThis as any).__ahaSimpleVisited = true;
        for (const k of Object.keys(sessionStorage)) if (k.startsWith('simpletablast_')) sessionStorage.removeItem(k);
    }
    untrack(async () => {
        try { workflows = (await api.comfyListWorkflows()).workflows.filter(w => w.enable_in_simple); }
        catch (e) { err = e instanceof Error ? e.message : String(e); }
        loading = false;
        const w = ui.simpleTarget && workflows.find(x => x.name === ui.simpleTarget);
        if (w) open(w);
    });
    const folders = $derived([...new Set(workflows.flatMap(w => { const p = w.name.split('/').slice(0, -1); return p.map((_, i) => p.slice(0, i + 1).join('/')); }))].sort());
    const shown = $derived(workflows.filter(w => (!folder || w.name.startsWith(folder + '/')) && (!search || `${w.name}\n${w.description ?? ''}`.toLowerCase().includes(search.toLowerCase()))));
    const key = (w: string, id: string) => `simpletablast_${w}_${id}`;
    const histKey = (w: string) => `simpletabhistory_${w}`;
    function saveHistory() { if (selected) localStorage.setItem(histKey(selected.name), JSON.stringify(batch.filter(e => !e.loading && !e.src.startsWith('data:')).map(e => e.src).reverse().slice(-20))); }

    async function open(w: WF) {
        selected = w; wf = null; params = []; current = null; preview = null;
        ui.setSimpleTarget(w.name);
        try { batch = (JSON.parse(localStorage.getItem(histKey(w.name)) ?? '[]') as string[]).reverse().map(src => ({ src })); } catch { batch = []; }
        current = batch[0]?.src ?? null;
        try {
            const r = (await api.comfyReadWorkflow(w.name)).result;
            const list = Object.values<any>(JSON.parse(r.custom_params));
            const pv = r.param_values ? JSON.parse(r.param_values) : {};
            for (const k of Object.keys(values)) delete values[k];
            for (const k of Object.keys(toggles)) delete toggles[k];
            const g: Record<string, boolean> = {};
            for (const p of list) {
                if (p.id in pv) p.default = pv[p.id];
                const last = sessionStorage.getItem(key(w.name, p.id));
                const lv = last !== null ? JSON.parse(last) : null;
                values[p.id] = lv ?? (p.type === 'boolean' ? `${p.default}` === 'true' : p.type === 'list' && typeof p.default === 'string' ? p.default.split(',').map((x: string) => x.trim()).filter(Boolean) : p.default);
                toggles[p.id] = !p.toggleable || lv !== null;
                if (p.group?.toggles) g[p.group.id] = localStorage.getItem(`ahaswarm.simple.group.${p.group.id}`) === 'yes';
            }
            groupOn = g;
            params = list.sort((a, b) => (a.group?.priority ?? 0) - (b.group?.priority ?? 0) || (a.priority ?? 0) - (b.priority ?? 0));
            wf = { prompt: r.prompt, custom: r.custom_params };
        }
        catch (e) { ui.error(e); back(); }
    }
    function back() { sock?.close?.(); selected = null; ui.setSimpleTarget(null); }
    const advCount = $derived(params.filter(p => p.visible !== false && p.advanced).length);
    const groups = $derived.by(() => {
        const g: { id: string; name: string; desc?: string; open: boolean; toggles: boolean; items: any[] }[] = [];
        for (const p of params.filter(p => p.visible !== false && (!p.advanced || ui.settings.showAdvanced))) {
            const id = p.group?.id ?? '_';
            let e = g.find(x => x.id === id);
            if (!e) g.push((e = { id, name: p.group?.name ?? 'Inputs', desc: p.group?.description, open: (localStorage.getItem(`ahaswarm.simple.open.${id}`) ?? (p.group?.open !== false ? 'open' : 'closed')) === 'open', toggles: !!p.group?.toggles, items: [] }));
            e.items.push(p);
        }
        return g;
    });

    const isVideo = (s: string) => /\.(mp4|webm|mov|gif)$/i.test(s.split('?')[0]) || s.startsWith('data:video');
    const isAudio = (s: string) => /\.(mp3|wav|ogg|flac|aac)$/i.test(s.split('?')[0]) || s.startsWith('data:audio');
    function generate() {
        if (!selected || !wf || running) return;
        const input: Record<string, any> = { images: 1, model: '(none)', comfyworkflowraw: wf.prompt, comfyworkflowparammetadata: wf.custom, personalnote: `SimpleTab: Workflow: ${selected.name}` };
        for (const p of params) {
            if (!toggles[p.id] || (p.group?.toggles && !groupOn[p.group.id])) continue;
            let v = values[p.id];
            if (v && typeof v === 'object' && !Array.isArray(v)) { if (!v.data) continue; if (v.filename) input[`${p.id}_filename`] = v.filename; v = v.data; }
            else if (Array.isArray(v)) v = v.map((x: any) => (typeof x === 'object' ? x.data : x));
            if (v === null || v === undefined) continue;
            input[p.id] = v;
        }
        running = true; progress = { cur: 0, all: 0 }; preview = null;
        const name = selected.name;
        const h = api.generateWS(input, m => {
            if (m.gen_progress) {
                progress = { cur: m.gen_progress.current_percent ?? 0, all: m.gen_progress.overall_percent ?? 0 };
                if (m.gen_progress.preview) preview = m.gen_progress.preview;
            }
            if (m.image && selected?.name === name) { current = m.image.image; batch = [{ src: m.image.image }, ...batch].slice(0, 100); preview = null; saveHistory(); }
        });
        sock = h as any;
        h.done.catch(e => ui.error(e)).finally(() => { running = false; progress = null; preview = null; sock = null; });
    }
    function interrupt() { api.interruptAll().catch(e => ui.error(e)); }
    async function clearBatch() {
        if (!(await ui.ask('Clear this workflow\'s results?', 'Removes the results from this strip (the images stay in your output history).', { confirmLabel: 'Clear' }))) return;
        batch = []; current = null; if (selected) localStorage.removeItem(histKey(selected.name));
    }
</script>

<div class="page">
    {#if !selected}
        <div class="browse">
            <div class="bar ui-dense">
                <div class="search"><TextInput type="search" aria-label="Search workflows" placeholder="Search workflows…" bind:value={search} /></div>
                {#if folders.length}<div class="sel"><Dropdown ariaLabel="Folder" options={[{ value: '', label: 'All folders' }, ...folders.map(f => ({ value: f, label: f }))]} bind:value={folder} /></div>{/if}
                <div class="sel"><Dropdown ariaLabel="Display format" options={FORMAT_OPTIONS} value={format} onchange={(v: string) => { format = v as any; saveFormat('simple', v); }} /></div>
            </div>
            {#if loading}<BrowserSkeleton {format} label="Loading workflows" />
            {:else if err}<EmptyState icon={LWorkflow} title="Couldn't load workflows" message={err} />
            {:else if !shown.length}<EmptyState icon={search ? LSearch : LWorkflow} title={search || folder ? 'No matching workflows' : 'No Simple tab workflows'} message={search || folder ? 'Try another search or folder.' : "Save a workflow in the Comfy Workflow editor with 'Enable In Simple' checked and it shows up here."} />
            {:else}
                <div class={formatClass(format)}>
                    {#each shown as w (w.name)}
                        {@const slash = w.name.lastIndexOf('/')}
                        <BrowserCard labelFit={labelFit(format)} src={w.image ? resolveUrl(w.image) : ''} title={slash >= 0 ? w.name.slice(slash + 1) : w.name}
                            label={w.name} subtitle={slash >= 0 ? w.name.slice(0, slash) : ''} description={w.description ?? ''}
                            onclick={() => open(w)}
                            ontileclick={(e: MouseEvent) => { if (!(e.target as HTMLElement).closest('button, .desc')) open(w); }} />
                    {/each}
                </div>
            {/if}
        </div>
    {:else}
        <div class="run">
            <aside class="inputs ui-dense">
                <div class="head">
                    <Button icon={LArrowLeft} onclick={back}>Workflows</Button>
                </div>
                <div class="intro">
                    <h2>{selected.name}</h2>
                    {#if selected.description}<p class="wdesc">{selected.description}</p>{/if}
                    {#if advCount}<Toggle size="sm" label="Display advanced options ({advCount})" bind:checked={ui.settings.showAdvanced} onchange={() => ui.saveSettings()} />{/if}
                </div>
                <div class="scroll">
                    {#if !wf}<Skeleton lines={6} label="Loading workflow" />{/if}
                    {#each groups as g (g.id)}
                        <ParamGroup title={g.name} description={g.desc} open={g.open} ontoggle={(o: boolean) => localStorage.setItem(`ahaswarm.simple.open.${g.id}`, o ? 'open' : 'closed')}
                            toggleable={g.toggles} enabled={!!groupOn[g.id]} onenable={(en: boolean) => { groupOn[g.id] = en; localStorage.setItem(`ahaswarm.simple.group.${g.id}`, en ? 'yes' : 'no'); }}>
                            {#each g.items as p (p.id)}<ParamInput param={p} {store} />{/each}
                        </ParamGroup>
                    {/each}
                </div>
                <div class="gen">
                    <Button variant="primary" size="hero" icon={LSparkles} block disabled={!wf} onclick={generate}>{running ? 'Generating…' : 'Generate'}</Button>
                    {#if running}<IconButton variant="danger" icon={LX} label="Interrupt" title="Interrupt the running generation" onclick={interrupt} />{/if}
                </div>
            </aside>
            <section class="out">
                {#if progress}<ProgressPair overall={progress.all} current={progress.cur} label="Generating" />{/if}
                <div class="img" class:busy={running && !preview}>
                    {#if preview}<img src={preview} alt="Live preview" />
                    {:else if current}
                        {#if isVideo(current)}<VideoPlayer src={resolveUrl(current)} label="Result" />
                        {:else if isAudio(current)}<AudioPlayer src={resolveUrl(current)} label="Result" />
                        {:else}<button class="imgbtn" onclick={() => current && (ui.fullView = { src: current, metadata: null })}><img src={resolveUrl(current)} alt="Result" /></button>{/if}
                    {:else if !running}<EmptyState icon={LWorkflow} title="Ready" message="Set the inputs on the left and press Generate." />{/if}
                </div>
                {#if batch.length}
                    <div class="strip ui-dense">
                        <IconButton variant="danger" icon={LTrash} label="Clear results" title="Clear this workflow's results" onclick={clearBatch} />
                        {#each batch as b, i (b.src + i)}<div class="th">{#if isVideo(b.src) || isAudio(b.src)}<button class="media" class:on={b.src === current} onclick={() => (current = b.src)}>{isVideo(b.src) ? 'Video' : 'Audio'} {batch.length - i}</button>{:else}<GalleryCard src={resolveUrl(b.src)} alt="Result {i + 1}" selected={b.src === current} onclick={() => (current = b.src)} />{/if}</div>{/each}
                    </div>
                {/if}
            </section>
        </div>
    {/if}
</div>

<style>
    .page { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--color-bg); }
    .browse { flex: 1; min-height: 0; overflow-y: auto; padding: var(--param-gutter); }
    .bar { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-2); }
    .search { width: 240px; }
    .sel { width: 170px; }
    .run { flex: 1; min-height: 0; display: flex; }
    .inputs { flex: 0 0 380px; min-width: 0; display: flex; flex-direction: column; background: var(--param-panel-bg); padding: var(--param-gutter) 0 var(--param-gutter); gap: var(--space-1); container: params / inline-size; }
    .head, .intro, .gen { padding: 0 var(--param-gutter); }
    .intro { display: flex; flex-direction: column; gap: var(--space-1); padding-left: calc(var(--param-gutter) + var(--param-pad-x)); padding-right: calc(var(--param-gutter) + var(--param-pad-x)); }
    .intro h2 { margin: 0; font-size: 15px; }
    .wdesc { margin: 0; font-size: var(--text-small, 12px); color: var(--color-ink-3); white-space: pre-wrap; max-height: 6em; overflow: auto; }
    .scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-1); padding: 0 var(--param-gutter); }
    .scroll > :global(*) { flex-shrink: 0; }
    .scroll :global(.ui-group) {
        background: var(--param-section-bg); border-radius: var(--radius-ui); padding: var(--param-pad-y) var(--param-pad-x);
        --color-raised: var(--param-ctl); --color-hover: var(--param-ctl-hover); --color-active: var(--param-ctl-active);
        --color-control: var(--param-ctl); --color-control-hover: var(--param-ctl-hover); --color-control-active: var(--param-ctl-active);
    }
    .scroll :global(.ui-group > h3) { margin-top: 0; }
    .scroll :global(.ui-group > h3 .chev) { margin-left: -3.75px; }
    .scroll :global(.ui-group > .body > .inner > div) { gap: var(--param-row-gap); padding-top: var(--param-row-gap); }
    .gen { display: flex; gap: var(--space-1); padding-top: var(--space-1); }
    .out { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-2); background: var(--color-bg); }
    .img { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; transition: filter 150ms; }
    .img.busy { filter: blur(5px); }
    .img img, .img :global(.ui-video) { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .imgbtn { all: unset; cursor: zoom-in; max-width: 100%; max-height: 100%; display: flex; }
    .strip { flex: none; display: flex; gap: var(--space-1); align-items: center; overflow-x: auto; }
    .th { width: 72px; flex: none; }
    .media { width: 72px; height: 72px; border-radius: var(--radius-ui); background: var(--color-raised); font-size: 11px; }
    .media.on { outline: 2px solid var(--color-accent); }
    @media (max-width: 760px) { .run { flex-direction: column; overflow-y: auto; } .inputs { flex: none; } }
</style>
