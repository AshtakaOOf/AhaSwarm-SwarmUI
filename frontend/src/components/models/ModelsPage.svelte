<script lang="ts" module>
    import type { ModelInfo as CachedModel } from '../../lib/api/types';
    const listings = new Map<string, CachedModel[]>();
    const lastFolder: Record<string, string> = {};
</script>

<script lang="ts">
    import LCopy from '@lucide/svelte/icons/copy';
    import LFolder from '@lucide/svelte/icons/folder';
    import LInfo from '@lucide/svelte/icons/info';
    import LPencil from '@lucide/svelte/icons/pencil';
    import LPlus from '@lucide/svelte/icons/plus';
    import LStar from '@lucide/svelte/icons/star';
    import LTrash from '@lucide/svelte/icons/trash-2';
    import LTriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import LX from '@lucide/svelte/icons/x';
    import { api, hasPermission } from '../../lib/api/swarm';
    import type { ModelInfo } from '../../lib/api/types';
    import { resolveUrl } from '../../lib/api/client';
    import { cleanModelName, paramState } from '../../lib/state/params.svelte';
    import { modelPreviewSrc, selectModel } from '../../lib/state/models';
    import { ui } from '../../lib/state/ui.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { untrack } from 'svelte';
    import { Badge, Button, Dropdown, EmptyState, Icon, IconButton, Menu, NumberInput, Splitter, Tabs, Tree, VirtualGrid, TextInput, Toggle, CopyChip, type MenuItem, type TreeItem } from '../ui';
    import BrowserCard from '../browser/BrowserCard.svelte';
    import BrowserSkeleton from '../browser/BrowserSkeleton.svelte';
    import ModelInfoModal from './ModelInfoModal.svelte';
    import WildcardEditModal from './WildcardEditModal.svelte';
    import WildcardInfoModal from './WildcardInfoModal.svelte';
    import { cachedWildcardText, ensureWildcardText, forgetWildcardText, promptHasWildcard, toggleWildcardInPrompt, wildcardPreview, wildcardRawIsCut } from '../../lib/util/wildcard';

    const SUBTYPES = [
        { id: 'Stable-Diffusion', label: 'Models' },
        { id: 'LoRA', label: 'LoRAs' },
        { id: 'VAE', label: 'VAEs' },
        { id: 'Embedding', label: 'Embeddings' },
        { id: 'ControlNet', label: 'ControlNets' },
    ];
    import { descriptionHtml, modelFacts, stripHtml } from '../../lib/util/modelInfo';
    import { FORMAT_OPTIONS, formatClass, labelFit, formatLayout, isListFormat, loadFormat, saveFormat } from '../../lib/util/browserFormat';
    let { subtype: fixedSubtype = null }: { subtype?: string | null } = $props();
    let pickedSubtype = $state('Stable-Diffusion');
    const subtype = $derived(fixedSubtype ?? pickedSubtype);
    let files = $state.raw<ModelInfo[]>([]);
    let folders = $state<string[]>([]);
    let loading = $state(false);
    let error = $state<string | null>(null);
    let search = $state('');
    let folder = $state('');
    let depth = $state(Number(localStorage.getItem('ahaswarm.models.depth') ?? 6) || 6);
    $effect(() => localStorage.setItem('ahaswarm.models.depth', `${depth}`));
    let openKeys = $state<TreeItem['id'][]>(['']);
    const readTree = (st: string): TreeItem['id'][] => { try { return JSON.parse(localStorage.getItem(`ahaswarm.models.${st}.tree`) ?? '[""]'); } catch { return ['']; } };
    $effect.pre(() => {
        const st = subtype;
        untrack(() => { folder = lastFolder[st] ?? ''; openKeys = readTree(st); });
    });
    $effect(() => {
        lastFolder[subtype] = folder;
        localStorage.setItem(`ahaswarm.models.${subtype}.tree`, JSON.stringify(openKeys));
    });
    const rootLabel = $derived(SUBTYPES.find(t => t.id === subtype)?.label ?? subtype);
    const treeItems = $derived.by((): TreeItem[] => {
        const kids = new Map<string, Set<string>>([['', new Set()]]);
        const counts = new Map<string, number>();
        for (const f of files) {
            const parts = f.name.split('/').slice(0, -1);
            let cur = '';
            counts.set('', (counts.get('') ?? 0) + 1);
            for (const part of parts) {
                const next = cur ? `${cur}/${part}` : part;
                (kids.get(cur) ?? kids.set(cur, new Set()).get(cur)!).add(part);
                counts.set(next, (counts.get(next) ?? 0) + 1);
                cur = next;
            }
        }
        const build = (p: string): TreeItem[] => [...(kids.get(p) ?? [])].sort().map(name => {
            const full = p ? `${p}/${name}` : name;
            return { id: full, label: name, title: full, count: counts.get(full), children: kids.has(full) ? build(full) : undefined };
        });
        return [{ id: '', label: rootLabel, title: `All ${rootLabel}`, count: counts.get('') ?? 0, children: build('') }];
    });
    $effect(() => { if (folder && files.length && !folders.some(f => f === folder || f.startsWith(folder + '/'))) folder = ''; });
    function inFolder(name: string): boolean {
        if (folder && !name.startsWith(folder + '/')) return false;
        const rest = folder ? name.slice(folder.length + 1) : name;
        return rest.split('/').length <= depth;
    }
    let sortBy = $state(localStorage.getItem('ahaswarm.models.sort') ?? 'Name');
    let sortReverse = $state(localStorage.getItem('ahaswarm.models.reverse') === 'true');
    let selected = $state<ModelInfo | null>(null);
    let formats = $state<Record<string, string>>({});
    const format = $derived(formats[subtype] ?? loadFormat(`models.${subtype}`, 'Cards'));
    function setFormat(v: string) { formats[subtype] = v; saveFormat(`models.${subtype}`, v); }
    const strip = (h: unknown) => stripHtml(h, true);
    const isCards = $derived(format.includes('Cards'));
    const layout = $derived(formatLayout(format));

    function setFiles(list: ModelInfo[]) {
        files = list;
        folders = [...new Set(files.map(f => f.name.includes('/') ? f.name.substring(0, f.name.lastIndexOf('/')) : ''))].filter(Boolean).sort();
    }
    async function load(force = true) {
        const key = `${subtype}|${sortBy}|${sortReverse}`;
        const hit = listings.get(key);
        if (hit && !force) {
            setFiles(hit);
            return;
        }
        loading = !hit;
        error = null;
        selected = null;
        try {
            const res = await api.listModels(subtype, '', 20, sortBy, sortReverse);
            setFiles(res.files ?? []);
            listings.set(key, files);
        }
        catch (e) {
            error = e instanceof Error ? e.message : String(e);
            files = [];
        }
        loading = false;
    }

    async function reloadAll() {
        await paramState.load();
        await load();
    }

    $effect(() => {
        void subtype;
        void sortBy;
        void sortReverse;
        localStorage.setItem('ahaswarm.models.sort', sortBy);
        localStorage.setItem('ahaswarm.models.reverse', `${sortReverse}`);
        load(false);
    });

    let textRev = $state(0);
    $effect(() => {
        if (subtype !== 'Wildcards') {
            return;
        }
        const names = files.filter(f => wildcardRawIsCut(`${f.raw ?? ''}`)).map(f => f.name);
        let alive = true;
        ensureWildcardText(names, () => { if (alive) textRev++; });
        return () => { alive = false; };
    });
    const flat = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');
    // lower-cased search text, built once per listing instead of for every file on every keystroke
    const haystacks = $derived.by(() => {
        void textRev;
        return new Map(files.map(f => {
            const body = subtype === 'Wildcards' ? (cachedWildcardText(f.name) || f.raw || '') : (f.raw ?? '');
            return [f.name, flat(`${f.name} ${f.title ?? ''} ${f.author ?? ''} ${f.description ?? ''} ${body} ${f.trigger_phrase ?? ''} ${f.usage_hint ?? ''} ${(f.tags ?? []).join(' ')}`)];
        }));
    });
    const shown = $derived.by(() => {
        const q = flat(search.trim());
        return files.filter(f => inFolder(f.name) && (!q || (haystacks.get(f.name) ?? '').includes(q)));
    });

    const starredSet = $derived(new Set(presetState.userData?.starred_models?.[subtype] ?? []));
    const isStarred = (m: ModelInfo) => starredSet.has(m.name);
    async function toggleModelStar(m: ModelInfo) {
        const all: Record<string, string[]> = { ...($state.snapshot(presetState.userData?.starred_models) ?? {}) };
        const list = (all[subtype] ?? []).filter(n => n !== m.name);
        if (!isStarred(m)) {
            list.push(m.name);
        }
        if (list.length) {
            all[subtype] = list;
        }
        else {
            delete all[subtype];
        }
        if (presetState.userData) {
            presetState.userData.starred_models = all;
        }
        try {
            await api.setStarredModels(all);
        }
        catch (e) {
            ui.error(e);
        }
    }
    const ordered = $derived([...shown].sort((a, b) => Number(isStarred(b)) - Number(isStarred(a))));

    const embedChunk = (m: ModelInfo) => `<embed:${cleanModelName(m.name)}>`;

    const activeLoras = $derived(subtype === 'LoRA' ? new Set(paramState.loras.map(l => l.name)) : null);
    const activeValue = $derived(subtype === 'Stable-Diffusion' ? paramState.values['model'] : subtype === 'VAE' ? paramState.values['vae'] : undefined);
    const prompts = $derived(subtype === 'Embedding' ? `${paramState.values['prompt'] ?? ''} ${paramState.values['negativeprompt'] ?? ''}` : '');
    const promptText = $derived(`${paramState.values['prompt'] ?? ''}`);
    const canEditWc = $derived(subtype === 'Wildcards' && hasPermission('edit_wildcards'));
    function isActive(m: ModelInfo): boolean {
        switch (subtype) {
            case 'Stable-Diffusion':
            case 'VAE': return activeValue === cleanModelName(m.name) || activeValue === m.name;
            case 'LoRA': return !!activeLoras?.has(cleanModelName(m.name));
            case 'Embedding': return prompts.includes(embedChunk(m));
            case 'Wildcards': return promptHasWildcard(promptText, m.name);
            default: return false;
        }
    }

    function actionLabel(m: ModelInfo): string {
        switch (subtype) {
            case 'Stable-Diffusion': return 'Use model';
            case 'VAE': return 'Use VAE';
            case 'LoRA': return isActive(m) ? 'Remove LoRA' : 'Add LoRA';
            case 'Embedding': return isActive(m) ? 'Remove from prompt' : (m.is_negative_embedding ? 'Add to negative' : 'Add to prompt');
            case 'Wildcards': return isActive(m) ? 'Remove wildcard' : 'Add wildcard';
            default: return '';
        }
    }

    // classic browser click callbacks
    function use(m: ModelInfo) {
        switch (subtype) {
            case 'Stable-Diffusion':
                selectModel(cleanModelName(m.name), { ...m, name: cleanModelName(m.name) });
                break;
            case 'VAE':
                paramState.set('vae', cleanModelName(m.name));
                break;
            case 'LoRA':
                paramState.toggleLora(m.name, m as any);
                break;
            case 'Embedding': {
                const key = m.is_negative_embedding ? 'negativeprompt' : 'prompt';
                const chunk = embedChunk(m);
                const cur = `${paramState.values[key] ?? ''}`;
                paramState.set(key, cur.endsWith(chunk) ? cur.slice(0, -chunk.length).trim() : `${cur} ${chunk}`.trim());
                break;
            }
            case 'Wildcards':
                toggleWildcardInPrompt(m.name); // classic wildcardHelpers.selectWildcard
                break;
            default:
                selected = m;
        }
    }

    let wcEdit = $state<{ name: string; raw: string; image?: string } | null>(null);
    let wcMenu: Menu | undefined = $state();
    let wcTarget = $state<ModelInfo | null>(null);
    function openWcMenu(m: ModelInfo, e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        wcTarget = m;
        wcMenu?.openAt(e.clientX, e.clientY);
    }
    async function refreshWildcards() {
        forgetWildcardText();
        await api.triggerRefresh();
        await reloadAll();
    }
    async function duplicateWildcard(m: ModelInfo) {
        const res = await api.describeModel(m.name, 'Wildcards') as { model?: ModelInfo; name?: string; raw?: string; image?: string };
        const card = res.model ?? res;
        const taken = new Set(files.map(f => f.name.toLowerCase()));
        let i = 1;
        let next = `${card.name} - ${i}`;
        while (taken.has(next.toLowerCase())) {
            next = `${card.name} - ${++i}`;
        }
        const raw = `${card.raw ?? ''}`;
        const image = card.image && !`${card.image}`.includes('model_placeholder') ? card.image : undefined;
        await api.editWildcard(next, raw.endsWith('\n') ? raw : `${raw}\n`, image);
        await refreshWildcards();
        ui.toast(`Duplicated as ${next}.`, 'success');
    }
    async function deleteWildcard(m: ModelInfo) {
        if (!(await ui.ask('Delete wildcard?', `Delete ${m.name}? This cannot be undone.`, { confirmLabel: 'Delete' }))) {
            return;
        }
        await api.deleteWildcard(m.name);
        if (selected?.name === m.name) {
            selected = null;
        }
        await refreshWildcards();
    }
    const wcItems = $derived<MenuItem[]>(!wcTarget ? [] : [
        { label: 'Edit', icon: LPencil, onselect: () => wcTarget && (wcEdit = { name: wcTarget.name, raw: `${wcTarget.raw ?? ''}`, image: wcTarget.image }) },
        { label: 'Duplicate', icon: LCopy, onselect: () => wcTarget && duplicateWildcard(wcTarget).catch(e => ui.error(e)) },
        { label: 'Delete', icon: LTrash, danger: true, onselect: () => wcTarget && deleteWildcard(wcTarget).catch(e => ui.error(e)) },
    ]);

    function clean(n: string) {
        return n.replace(/\.(safetensors|ckpt|gguf|sft|pt|pth|bin)$/i, '');
    }
</script>

<div class="page">
<Splitter persistKey="ahaswarm.split.modeltree" label="Resize folder tree" defaultSize={200} min={140} max={480} unit="px" collapsible>
    {#snippet first()}
    <nav class="tree" aria-label="{rootLabel} folders">
        <Tree label="{rootLabel} folders" items={treeItems} bind:expanded={openKeys} selected={folder} onselect={(it: TreeItem) => (folder = `${it.id}`)} />
    </nav>
    {/snippet}
    {#snippet second()}
    <div class="main">
    <div class="top">
        {#if !fixedSubtype}<Tabs tabs={SUBTYPES} bind:value={pickedSubtype} label="Model type" />{/if}
        <div class="filters">
            <div class="filters-main">
                <div class="grow">
                    <div class="filter">
                        <TextInput type="search" placeholder={subtype === 'Wildcards' ? 'Search name or contents…' : 'Search name, title, author, tags…'} aria-label={subtype === 'Wildcards' ? 'Search wildcards' : 'Search models'} bind:value={search} />
                        {#if search}<button type="button" class="clear" aria-label="Clear search" title="Clear search" onclick={() => (search = '')}><Icon icon={LX} /></button>{/if}
                    </div>
                </div>
                <span class="lbl">Depth</span><div class="num"><NumberInput ariaLabel="Folder depth" min={1} max={20} bind:value={depth} /></div>
                <div class="sel"><Dropdown ariaLabel="Sort by" options={[{ value: 'Name', label: 'Name' }, { value: 'DateCreated', label: 'Newest created' }, { value: 'DateModified', label: 'Newest modified' }]} bind:value={sortBy} /></div>
                <div class="sel"><Dropdown ariaLabel="Display format" options={FORMAT_OPTIONS} value={format} onchange={setFormat} /></div>
                <Toggle label="Reverse" bind:checked={sortReverse} />
                <Button onclick={async () => { await api.triggerRefresh(); await reloadAll(); }}>Refresh</Button>
                {#if subtype === 'VAE'}<Button onclick={() => paramState.set('vae', 'Automatic')}>Automatic VAE</Button>{/if}
                {#if canEditWc}<Button icon={LPlus} onclick={() => (wcEdit = { name: folder ? `${folder}/` : '', raw: '' })}>Create</Button>{/if}
            </div>
            {#if shown.length}<p class="count"><Badge label="{shown.length} item{shown.length === 1 ? '' : 's'}" /></p>{/if}
        </div>
    </div>
    <div class="body">
        <div class="list">
            {#if loading}
                <BrowserSkeleton {format} label="Loading {subtype}" />
            {:else if error}
                <EmptyState icon={LTriangleAlert} title="Couldn't load models" message={error} />
            {:else if !shown.length}
                <EmptyState icon={LFolder} title="No {rootLabel.toLowerCase()} found" message={search ? 'Try a different search.' : (subtype === 'Wildcards' ? 'Create a wildcard, or add .txt files to the wildcards folder, then Refresh.' : 'Add files to the model folder, then Refresh.')} />
            {:else}
                <VirtualGrid items={ordered} key={(m: ModelInfo) => m.name} {...layout} class={formatClass(format)} label={subtype}>
                    {#snippet item(m: ModelInfo)}
                        {@const wc = subtype === 'Wildcards'}
                        <BrowserCard labelFit={labelFit(format)} src={modelPreviewSrc(m.preview_image || m.image)} placeholder="No preview"
                            title={wc ? (m.name.split('/').pop() ?? m.name) : (m.title || clean(m.name.split('/').pop() ?? m.name))}
                            subtitle={wc ? (m.name.includes('/') ? m.name.slice(0, m.name.lastIndexOf('/')) : '') : (m.author ? `by ${m.author}` : '')}
                            facts={isCards && !wc ? modelFacts(m, subtype, format.startsWith('Small') ? 'small' : 'card') : []}
                            description={wc ? (isCards ? wildcardPreview(m.raw) : '') : (isCards && strip(m.description) ? descriptionHtml(m.description) : '')} html={!wc}
                            selected={isActive(m)} onclick={() => use(m)}
                            ontitleclick={() => (selected = m)}
                            oncontextmenu={canEditWc ? (e: MouseEvent) => openWcMenu(m, e) : undefined}
                            ontileclick={(e: MouseEvent) => { if (isListFormat(format) && !(e.target as HTMLElement).closest('button, a, .desc')) use(m); }}>
                            {#snippet detail()}
                                {#if format === 'Details List' && subtype === 'Wildcards'}
                                    <span class="c-l mono">{m.name}</span>
                                    <span class="c-xl">{wildcardPreview(m.raw).split('\n').join(', ')}</span>
                                {:else if format === 'Details List'}
                                    {@const triggers = strip(m.trigger_phrase).split(';').map(t => t.trim()).filter(Boolean)}
                                    <span class="c-l mono">{m.name}</span>
                                    <span class="c-m">{m.class || m.architecture || ''}</span>
                                    <span class="c-s">{m.standard_width ? `${m.standard_width}×${m.standard_height}` : ''}</span>
                                    <span class="c-l chips">{#each triggers as t (t)}<CopyChip value={t} label="Copy trigger phrase {t}" />{/each}</span>
                                    <span class="c-m">{(m.tags ?? []).join(', ')}</span>
                                    <span class="c-xl">{strip(m.usage_hint) || strip(m.description)}</span>
                                {/if}
                            {/snippet}
                            {#snippet overlay()}
                                <IconButton icon={LStar} fill={isStarred(m) ? 'currentColor' : 'none'} label="{isStarred(m) ? 'Unstar' : 'Star'} {m.name}" pressed={isStarred(m)} onclick={() => toggleModelStar(m)} />
                                <IconButton icon={LInfo} label="Details for {m.name}" pressed={selected?.name === m.name} onclick={() => (selected = selected?.name === m.name ? null : m)} />
                            {/snippet}
                        </BrowserCard>
                    {/snippet}
                </VirtualGrid>
            {/if}
        </div>
        {#if wcEdit}<WildcardEditModal card={wcEdit} onclose={() => (wcEdit = null)} onsaved={async () => { wcEdit = null; await refreshWildcards(); }} />{/if}
        {#if canEditWc}<Menu bind:this={wcMenu} items={wcItems} label="Wildcard actions" context />{/if}
        {#if selected && subtype === 'Wildcards'}
            {@const m = selected}
            <WildcardInfoModal name={m.name} raw={`${m.raw ?? ''}`} image={m.image} starred={isStarred(m)} active={isActive(m)} canEdit={canEditWc}
                onuse={() => use(m)} onstar={() => toggleModelStar(m)}
                onedit={() => (wcEdit = { name: m.name, raw: `${m.raw ?? ''}`, image: m.image })}
                onduplicate={() => { void duplicateWildcard(m); }}
                ondelete={() => { void deleteWildcard(m); }}
                onclose={() => (selected = null)} />
        {/if}
        {#if selected && subtype !== 'Wildcards'}
            {@const m = selected}
            <ModelInfoModal model={m} {subtype} {folders} starred={isStarred(m)} active={isActive(m)} actionLabel={actionLabel(m)} onuse={() => use(m)} onstar={() => toggleModelStar(m)} onclose={() => (selected = null)} onreload={() => load()} onfileschanged={reloadAll} onsearchauthor={(author: string) => { search = author; selected = null; }} />
        {/if}
    </div>
    </div>
    {/snippet}
</Splitter>
</div>

<style>
    .page { display: flex; height: 100%; min-height: 0; }
    .tree { height: 100%; overflow: auto; padding: var(--space-1); }
    .main { height: 100%; min-width: 0; display: flex; flex-direction: column; }
    @media (max-width: 640px) { .page :global(.ui-splitter > .pane:first-child), .page :global(.ui-splitter > .ui-split-wrap) { display: none; } }
    .lbl { font-size: var(--text-small); color: var(--color-ink-3); }
    .num { width: 72px; }
    .top { padding: var(--space-2) var(--space-2) 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .filters { display: flex; gap: var(--space-2); align-items: center; padding-bottom: var(--space-2); }
    .filters-main { display: flex; flex: 1; min-width: 0; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    /* fixed-width search (same as History): toggling other controls never resizes it or shifts the row */
    .grow { flex: 0 1 240px; min-width: 160px; }
    .filter { position: relative; }
    .filter :global(input.ctl) { padding-left: 10px; padding-right: 30px; }
    .clear { position: absolute; top: 50%; right: 4px; translate: 0 -50%; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: 0; background: transparent; border-radius: var(--radius-sm); color: var(--color-ink-2); line-height: 0; transition: background-color 120ms, color 120ms; }
    .clear:hover, .clear:focus-visible { background: var(--color-active); color: var(--color-ink); }
    .clear:active { background: var(--color-active); }
    .sel { width: 180px; }
    .count { flex: none; margin: 0; }
    .body { flex: 1; min-height: 0; display: flex; }
    .list { flex: 1; min-width: 0; overflow-y: auto; padding: 0 var(--space-2) var(--space-3); }
</style>
