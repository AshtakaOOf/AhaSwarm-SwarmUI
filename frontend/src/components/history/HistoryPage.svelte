<script lang="ts" module>
    import type { HistoryFile as CachedFile } from '../../lib/api/types';
    const listings = new Map<string, { folders: string[]; files: CachedFile[] }>();
    let lastPath = '';
</script>

<script lang="ts">
    import { onMount, tick, untrack } from 'svelte';
    import LX from '@lucide/svelte/icons/x';
    import LChevronDown from '@lucide/svelte/icons/chevron-down';
    import LChevronRight from '@lucide/svelte/icons/chevron-right';
    import LImage from '@lucide/svelte/icons/image';
    import LStar from '@lucide/svelte/icons/star';
    import LTrash2 from '@lucide/svelte/icons/trash-2';
    import LTriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import { Icon } from '../ui';
    import { api, hasPermission, outputPrefix } from '../../lib/api/swarm';
    import type { HistoryFile } from '../../lib/api/types';
    import { resolveUrl } from '../../lib/api/client';
    import { gen } from '../../lib/state/gen.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { confirmAndDelete, deleteImage, toggleStar } from '../../lib/state/actions';
    import { imageMenuItems } from '../../lib/state/imageMenu';
    import { userSettings } from '../../lib/state/usersettings.svelte';
    import SquareCheck from '@lucide/svelte/icons/square-check';
    import SquareCheckBig from '@lucide/svelte/icons/square-check-big';
    import { fileName, mediaType } from '../../lib/util/metadata';
    import { Breadcrumb, Button, Dropdown, EmptyState, IconButton, LoadMore, Menu, VirtualGrid, NumberInput, Splitter, TextInput, Toggle, Toolbar, Tree, type KeyValue, type MenuItem, type TreeItem } from '../ui';
    import { swipe } from '../../lib/util/swipe';
    import { typingIn } from '../../lib/util/keys';
    import BrowserCard from '../browser/BrowserCard.svelte';
    import BrowserSkeleton from '../browser/BrowserSkeleton.svelte';

    import { formatOptions, coerceFormat, formatClass, labelFit, formatLayout, isListFormat, loadFormat, saveFormat } from '../../lib/util/browserFormat';
    let format = $state<string>(loadFormat('history', 'Thumbnails'));
    const viewFormat = $derived(coerceFormat(format, ui.portrait));
    const layout = $derived(formatLayout(viewFormat, ui.portrait));
    function info(f: HistoryFile) {
        let p: any = {};
        try { p = JSON.parse(f.metadata ?? '{}')?.sui_image_params ?? {}; } catch {}
        const res = p.width && p.height ? `${p.width}×${p.height}` : p.aspectratio ?? '';
        return { prompt: `${p.prompt ?? ''}`, model: `${p.model ?? ''}`.split('/').pop() ?? '', res, seed: p.seed != null ? `seed ${p.seed}` : '' };
    }
    function facts(inf: ReturnType<typeof info>): KeyValue[] {
        const out: KeyValue[] = [];
        if (inf.model) out.push({ key: 'Model', value: inf.model });
        if (inf.res) out.push({ key: 'Resolution', value: inf.res });
        if (inf.seed) out.push({ key: 'Seed', value: inf.seed.replace(/^seed /, '') });
        return out;
    }
    let path = $state(lastPath);
    let treeOpen = $state(false);
    let folders = $state<string[]>([]);
    let files = $state.raw<HistoryFile[]>([]);
    // folder the current `files` were listed from (src is relative to it); `path` changes before the reload lands
    let filesPath = $state('');
    let loading = $state(false);
    let error = $state<string | null>(null);
    let sort = $state(localStorage.getItem('ahaswarm.history.sort') ?? 'Name');
    let reverse = $state(localStorage.getItem('ahaswarm.history.reverse') === 'true');
    const DEPTH_MAX = 10;
    let depth = $state(Number(localStorage.getItem('ahaswarm.history.depth') ?? DEPTH_MAX) || DEPTH_MAX);
    const usedDepth = $derived(ui.settings.hideFolderDepth ? DEPTH_MAX : depth);
    let filter = $state('');
    const PAGE = 150;
    let limit = $state(PAGE);
    // infinite scroll: the whole listing in the (windowed) grid instead of pages with a Show more button
    let infinite = $state(localStorage.getItem('ahaswarm.history.infinite') === 'true');
    function setInfinite(v: boolean) { infinite = v; localStorage.setItem('ahaswarm.history.infinite', `${v}`); }
    let filterTimer: number | undefined;

    let loadSeq = 0;
    async function load() {
        const seq = ++loadSeq;
        const at = path;
        lastPath = at;
        const key = `${at}|${usedDepth}|${sort}|${reverse}|${filter.trim()}`;
        const hit = listings.get(key);
        if (hit && (filesPath !== at || !files.length)) {
            folders = hit.folders;
            files = hit.files;
            filesPath = at;
        }
        loading = true;
        error = null;
        limit = PAGE;
        try {
            const res = await api.listImages(at, usedDepth, sort, reverse, filter.trim() || null);
            if (seq !== loadSeq) return;
            folders = (res.folders ?? []).filter(f => !f.includes('/')).sort();
            files = (res.files ?? []).filter(f => !f.src.endsWith('.html'));
            filesPath = at;
            listings.set(key, { folders, files });
            rememberFolders(path, res.folders ?? []);
            selected = new Set();
            anchor = -1;
        }
        catch (e) {
            if (seq !== loadSeq) return;
            error = e instanceof Error ? e.message : String(e);
        }
        loading = false;
    }

    $effect(() => {
        void path; void sort; void reverse; void usedDepth;
        localStorage.setItem('ahaswarm.history.sort', sort);
        localStorage.setItem('ahaswarm.history.reverse', `${reverse}`);
        localStorage.setItem('ahaswarm.history.depth', `${depth}`);
        // load writes files, which this would otherwise track and refetch forever
        untrack(load);
    });
    $effect(() => {
        if (ui.historyPath !== null) {
            path = ui.historyPath;
            ui.historyPath = null;
        }
    });
    $effect(() => {
        if (ui.historyFilter !== null) {
            filter = ui.historyFilter;
            ui.historyFilter = null;
            if (path) path = '';
            else load();
        }
    });

    let tree = $state<Record<string, string[]>>({});
    let openKeys = $state<TreeItem['id'][]>(['']);
    function rememberFolders(base: string, list: string[]) {
        const next = { ...tree };
        const join = (a: string, b: string) => (a ? `${a}/${b}` : b);
        const root = base.replace(/\/$/, '');
        const kids: Record<string, Set<string>> = { [root]: new Set() };
        for (const f of list) {
            const parts = f.split('/').filter(Boolean);
            let cur = root;
            for (const part of parts) {
                (kids[cur] ??= new Set()).add(part);
                cur = join(cur, part);
                kids[cur] ??= new Set();
            }
        }
        for (const [k, v] of Object.entries(kids)) {
            if (v.size || !(k in next) || k === root) {
                next[k] = [...v].sort();
            }
        }
        tree = next;
    }
    $effect(() => {
        if (!('' in tree) && path) {
            api.listImages('', 1, 'Name', false, null).then(r => rememberFolders('', r.folders ?? [])).catch(() => {});
        }
    });
    $effect(() => {
        const parts = path.split('/').filter(Boolean);
        const want = parts.map((_, i) => parts.slice(0, i + 1).join('/'));
        const add = want.filter(k => !openKeys.includes(k));
        if (add.length) {
            openKeys = [...openKeys, ...add];
        }
    });
    const treeItems = $derived.by((): TreeItem[] => {
        const build = (p: string): TreeItem[] => (tree[p] ?? []).map(name => {
            const full = p ? `${p}/${name}` : name;
            const kids = tree[full];
            return kids === undefined ? { id: full, label: name, title: full, lazy: true } : { id: full, label: name, title: full, children: build(full) };
        });
        return [{ id: '', label: 'Output', title: 'Output root', children: build('') }];
    });
    async function loadFolder(it: TreeItem): Promise<TreeItem[]> {
        const p = `${it.id}`;
        const r = await api.listImages(p, 1, 'Name', false, null).catch(() => null);
        rememberFolders(p, r?.folders ?? []);
        return (tree[p] ?? []).map(name => ({ id: `${p}/${name}`, label: name, title: `${p}/${name}`, lazy: true }));
    }

    let multi = $state(false);
    let selected = $state<Set<string>>(new Set());
    let anchor = -1;
    let listEl = $state<HTMLDivElement>();
    let focusIdx = $state(-1);
    const visFiles = $derived(infinite ? files : files.slice(0, limit));
    function gridCols(): number {
        const win = listEl?.querySelector('.ui-vgrid-win') as HTMLElement | undefined;
        if (!win) {
            return 1;
        }
        return getComputedStyle(win).gridTemplateColumns.split(/\s+/).filter(s => s && s !== 'none').length || 1;
    }
    async function focusCard(i: number) {
        const cols = Math.max(1, gridCols());
        const win = listEl?.querySelector('.ui-vgrid-win') as HTMLElement | undefined;
        if (listEl && win) {
            const rowH = parseFloat(getComputedStyle(win).gridAutoRows) || 120;
            const gap = parseFloat(getComputedStyle(win).rowGap) || 8;
            const top = Math.floor(i / cols) * (rowH + gap);
            const mid = top + rowH / 2;
            if (mid < listEl.scrollTop || mid > listEl.scrollTop + listEl.clientHeight) {
                listEl.scrollTop = Math.max(0, top - (listEl.clientHeight - rowH) / 2);
            }
        }
        await tick();
        const btn = listEl?.querySelector(`[data-hist-i="${i}"] .card-btn`) as HTMLElement | undefined;
        btn?.focus({ preventScroll: true });
        btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function gridKey(e: KeyboardEvent) {
        if (e.defaultPrevented || typingIn(e) || e.altKey || e.metaKey || e.ctrlKey) {
            return;
        }
        const vis = visFiles;
        if (!vis.length) {
            return;
        }
        const cols = Math.max(1, gridCols());
        let i = focusIdx;
        if (i < 0 || i >= vis.length) {
            i = vis.findIndex(f => gen.current?.src === fullSrc(f));
            if (i < 0) {
                i = 0;
            }
        }
        if (e.key === 'ArrowLeft') {
            i -= 1;
        }
        else if (e.key === 'ArrowRight') {
            i += 1;
        }
        else if (e.key === 'ArrowUp') {
            i -= cols;
        }
        else if (e.key === 'ArrowDown') {
            i += cols;
        }
        else if (e.key === 'Home') {
            i = 0;
        }
        else if (e.key === 'End') {
            i = vis.length - 1;
        }
        else if (e.key === 'Enter') {
            if (e.target instanceof HTMLElement && e.target.closest('button, a, input, textarea, select')) {
                return;
            }
            e.preventDefault();
            const f = vis[Math.max(0, Math.min(vis.length - 1, i))];
            if (f) {
                clickFile(f, Math.max(0, i), { ctrlKey: multi, shiftKey: e.shiftKey, metaKey: false } as MouseEvent);
            }
            return;
        }
        else if (e.key === 'Delete' && canDelete) {
            e.preventDefault();
            if (multi && selected.size) {
                void bulkDelete(e);
            }
            else {
                const f = vis[Math.max(0, Math.min(vis.length - 1, i))];
                if (f) {
                    void del(f, e);
                }
            }
            return;
        }
        else {
            return;
        }
        e.preventDefault();
        i = Math.max(0, Math.min(vis.length - 1, i));
        focusIdx = i;
        void focusCard(i);
    }

    function clickFile(f: HistoryFile, i: number, e: MouseEvent) {
        if (multi || e.shiftKey || e.ctrlKey || e.metaKey) {
            const next = new Set(selected);
            if (e.shiftKey && anchor !== -1) {
                const [a, b] = anchor < i ? [anchor, i] : [i, anchor];
                for (const x of files.slice(a, b + 1)) {
                    next.add(x.src);
                }
            }
            else if (next.has(f.src)) {
                next.delete(f.src);
            }
            else {
                next.add(f.src);
            }
            anchor = i;
            selected = next;
            multi = true;
            focusIdx = i;
            return;
        }
        select(f);
        focusIdx = i;
    }
    function setMulti(on: boolean) {
        multi = on;
        if (!on) {
            selected = new Set();
            anchor = -1;
        }
    }
    const selFiles = $derived(files.filter(f => selected.has(f.src)));
    const canStar = hasPermission('user_star_images');
    const canDelete = hasPermission('user_delete_image');
    const isStarredFile = (f: HistoryFile) => {
        try {
            return !!JSON.parse(f.metadata ?? '{}')?.is_starred;
        }
        catch {
            return false;
        }
    };
    async function bulkStar(on: boolean) {
        for (const f of selFiles) {
            if (isStarredFile(f) !== on) {
                await toggleStar(fullSrc(f));
            }
        }
        load();
    }
    async function bulkDelete(e?: KeyboardEvent | MouseEvent) {
        const n = selFiles.length;
        const ask = `${userSettings.get('ui.checkifsurebeforedelete', true)}` !== 'false';
        if (ask && !(e && 'shiftKey' in e && e.shiftKey) && !confirm(`Are you sure you want to delete ${n} image${n === 1 ? '' : 's'}?`)) {
            return;
        }
        for (const f of selFiles) {
            await deleteImage(fullSrc(f));
        }
        load();
    }
    const bulkItems = $derived<MenuItem[]>([
        { label: 'Select All', onselect: () => (selected = new Set((infinite ? files : files.slice(0, limit)).map(f => f.src))) },
        { label: 'Clear Selection', disabled: !selected.size, onselect: () => (selected = new Set()) },
        ...(canStar ? [
            { separator: true },
            { label: 'Enable Starred', icon: LStar, disabled: !selected.size, title: 'Marks all selected images as starred if they are not already', onselect: () => bulkStar(true) },
            { label: 'Disable Starred', disabled: !selected.size, title: 'Marks all selected images as NOT starred if they are currently starred', onselect: () => bulkStar(false) },
        ] : []),
        ...(canDelete ? [
            { separator: true },
            { label: 'Delete', icon: LTrash2, danger: true, disabled: !selected.size, title: 'Deletes the selected images from the server', onselect: () => bulkDelete() },
        ] : []),
    ]);

    let ctxMenu: ReturnType<typeof Menu> | undefined = $state();
    let ctxFile = $state<HistoryFile | null>(null);
    let ctxIndex = -1;
    function histMenuItems(f: HistoryFile): MenuItem[] {
        const src = fullSrc(f);
        return [
            { label: 'Set as Current Image', onselect: () => select(f) },
            { label: selected.has(f.src) ? 'Deselect' : 'Select', onselect: () => clickFile(f, ctxIndex, { ctrlKey: true } as MouseEvent) },
            { separator: true },
            ...imageMenuItems({ src, metadata: f.metadata }, isStarredFile(f)).map(it => {
                if (it.separator || !it.onselect) {
                    return it;
                }
                const run = it.onselect;
                return { ...it, onselect: () => { void Promise.resolve(run()).then(() => { if (it.danger) files = files.filter(x => x !== f); else void load(); }); } };
            }),
        ];
    }
    const ctxItems = $derived<MenuItem[]>(ctxFile ? histMenuItems(ctxFile) : []);

    function onFilter(v: string) {
        filter = v;
        clearTimeout(filterTimer);
        filterTimer = window.setTimeout(load, 300);
    }

    const crumbs = $derived(path ? path.split('/').filter(Boolean) : []);
    const crumbItems = $derived([{ label: 'Output', title: 'Output root' }, ...crumbs.map(c => ({ label: c, href: '#history' }))].map((c, i, a) => (i < a.length - 1 ? { ...c, href: '#history' } : c)));
    function fullSrc(f: HistoryFile): string {
        const prefix = filesPath ? (filesPath.endsWith('/') ? filesPath : filesPath + '/') : '';
        return `${outputPrefix()}/${prefix}${f.src}`;
    }
    function thumb(f: HistoryFile): string {
        return resolveUrl(fullSrc(f) + (mediaType(f.src) === 'image' ? '?preview=true' : ''));
    }
    function select(f: HistoryFile) {
        gen.setCurrent(fullSrc(f), f.metadata);
    }
    async function del(f: HistoryFile, e: { shiftKey: boolean }) {
        if (await confirmAndDelete(fullSrc(f), e.shiftKey)) {
            files = files.filter(x => x !== f);
        }
    }
    onMount(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || typingIn(e)) {
                return;
            }
            const el = e.target;
            if (el instanceof Element && el.closest('.ui-modal, .tree, .tree-pop, .filters, .crumbs')) {
                return;
            }
            if (el instanceof Element && el !== document.body && el !== document.documentElement && !el.closest('.page')) {
                return;
            }
            gridKey(e);
        };
        addEventListener('keydown', onKey);
        return () => removeEventListener('keydown', onKey);
    });
</script>

{#snippet folderTree()}
    <nav class="tree" aria-label="History folders">
        <Tree label="History folders" items={treeItems} bind:expanded={openKeys} selected={path} loadChildren={loadFolder}
            onselect={(it: TreeItem) => { path = `${it.id}`; treeOpen = false; }} />
    </nav>
{/snippet}

<div class="page" use:swipe={{ enabled: ui.mobile && !treeOpen, only: 'x', onswipe: (d) => { if (d === 'right') treeOpen = true; } }}>
<Splitter persistKey="ahaswarm.split.histtree" label="Resize folder tree" defaultSize={200} min={140} max={480} unit="px" collapsible>
    {#snippet first()}
    {#if !ui.mobile}{@render folderTree()}{/if}
    {/snippet}
    {#snippet second()}
    <div class="main">
    <div class="top">
        <div class="crumbs">
            <Breadcrumb label="Folder path" items={crumbItems} onnavigate={(_c, i) => (path = i === 0 ? '' : crumbs.slice(0, i).join('/'))} oncurrent={ui.mobile ? () => (treeOpen = true) : undefined} />
            <Toolbar label="Selection">
                <span class="bulk" class:off={!multi} inert={!multi} aria-hidden={!multi}>
                    {#if canStar}<Button icon={LStar} title="Enable Starred on the selected images" disabled={!selected.size} onclick={() => bulkStar(true)}><span class="ql">Star</span></Button>{/if}
                    {#if canDelete}<Button icon={LTrash2} variant="danger" title="Delete the selected images" disabled={!selected.size} onclick={(e: MouseEvent) => bulkDelete(e)}><span class="ql">Delete</span></Button>{/if}
                    <Menu items={bulkItems} label="Bulk actions">
                        {#snippet trigger(p)}<Button {...p}><span class="ql">More</span> <Icon icon={LChevronDown} /></Button>{/snippet}
                    </Menu>
                </span>
            </Toolbar>
            <Button variant={multi ? 'primary' : 'default'} aria-pressed={multi} class="sel-btn" icon={multi ? SquareCheckBig : SquareCheck} onclick={() => setMulti(!multi)}>{multi ? `${selected.size} selected` : 'Select'}</Button>
        </div>
        <div class="filters">
            <div class="grow"><TextInput type="search" placeholder="Filter by file name or metadata…" aria-label="Filter history" value={filter} oninput={onFilter} /></div>
            <div class="sel"><Dropdown ariaLabel="Display format" options={formatOptions(ui.portrait)} value={viewFormat} onchange={(v: string) => { format = v; saveFormat('history', v); }} /></div>
            {#if !ui.settings.hideFolderDepth}<span class="lbl">Depth</span><div class="num"><NumberInput ariaLabel="Folder depth" min={1} max={DEPTH_MAX} bind:value={depth} /></div>{/if}
            <span class="lbl">Sort</span><div class="sel"><Dropdown ariaLabel="Sort by" options={[{ value: 'Name', label: 'Name' }, { value: 'Date', label: 'Date' }]} bind:value={sort} /></div>
            <Toggle label="Reverse" bind:checked={reverse} />
            <Toggle label="Infinite scroll" checked={infinite} onchange={setInfinite} />
            <Button onclick={load}>Refresh</Button>
        </div>
    </div>
    <div class="list" bind:this={listEl}>
        {#if loading && !files.length}
            <BrowserSkeleton format={viewFormat} label="Loading history" />
        {:else if error}
            <EmptyState icon={LTriangleAlert} title="Couldn't load history" message={error} />
        {:else if !files.length}
            <EmptyState icon={LImage} title="No images here yet" message="Generated images will show up here." />
        {:else}
            <!-- windowed: only visible rows are mounted -->
            <VirtualGrid items={infinite ? files : files.slice(0, limit)} key={(f: HistoryFile) => f.src} {...layout} class={formatClass(viewFormat)} label="Images">
                {#snippet item(f: HistoryFile, i: number)}
                    {@const inf = info(f)}
                    <div class="cell" data-hist-i={i}>
                    <BrowserCard labelFit={labelFit(viewFormat)} src={thumb(f)} alt={fileName(f.src)} title={fileName(f.src)} facts={facts(inf)} description={inf.prompt}
                        cols={[inf.prompt, inf.model, inf.res, inf.seed]}
                        selectable={multi} selecting={multi} checked={selected.has(f.src)} selected={!multi && gen.current?.src === fullSrc(f)}
                        onclick={(e: MouseEvent) => clickFile(f, i, e)}
                        oncheck={(_c: boolean, e: MouseEvent) => clickFile(f, i, { shiftKey: e.shiftKey, ctrlKey: true, metaKey: false } as MouseEvent)}
                        ontileclick={(e: MouseEvent) => { if (isListFormat(viewFormat) && !(e.target as HTMLElement).closest('button, .desc')) clickFile(f, i, e); }}
                        oncontextmenu={(e: MouseEvent) => { e.preventDefault(); ctxFile = f; ctxIndex = i; ctxMenu?.openAt(e.clientX, e.clientY); }}>
                        {#snippet overlay()}
                            {#if !multi}
                                {#if canStar}<IconButton icon={LStar} fill={isStarredFile(f) ? 'currentColor' : 'none'} label="Star / unstar" onclick={() => toggleStar(fullSrc(f)).then(load)} />{/if}
                                {#if canDelete}<IconButton icon={LTrash2} label="Delete (Shift: skip confirm)" onclick={(e: MouseEvent) => del(f, e)} />{/if}
                            {/if}
                        {/snippet}
                    </BrowserCard>
                    </div>
                {/snippet}
            </VirtualGrid>
            <Menu bind:this={ctxMenu} items={ctxItems} label="Image actions" context />
            {#if !infinite}<LoadMore remaining={files.length - limit} onmore={() => (limit += PAGE)} />{/if}
        {/if}
    </div>
    </div>
    {/snippet}
</Splitter>
{#if ui.mobile && treeOpen}
    <div class="tree-pop" use:swipe={{ enabled: true, only: 'x', onswipe: (d) => { if (d === 'left' || d === 'right') treeOpen = false; } }}>
        <div class="tree-bar"><span>Folders</span><IconButton icon={LX} label="Close folders" onclick={() => (treeOpen = false)} /></div>
        {@render folderTree()}
    </div>
{/if}
</div>

<style>
    .page { position: relative; isolation: isolate; display: flex; height: 100%; min-height: 0; }
    .tree-pop { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: var(--color-panel); animation: tree-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    @keyframes tree-in { from { transform: translateX(-100%); } }
    .tree-bar { flex: none; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-1) var(--space-1) var(--space-2); }
    .tree-bar span { flex: 1; font-weight: 600; }
    .tree-pop .tree { flex: 1; min-height: 0; height: auto; }
    .tree { height: 100%; overflow: auto; padding: var(--space-1); }
    .main { height: 100%; min-width: 0; display: flex; flex-direction: column; container: hist / inline-size; }
    @media (max-width: 768px) { .page :global(.ui-splitter > .pane:first-child), .page :global(.ui-splitter > .ui-split-wrap) { display: none; } }
    @media (max-width: 768px) {
        .page, .main, .list, .tree { min-width: 0; overflow-x: hidden; overscroll-behavior-x: none; }
        .list { touch-action: pan-y; }
    }
    .top { flex: 0 1 auto; min-height: 0; overflow: auto; padding: var(--space-2); display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); }
    .crumbs { flex: 1 1 100%; min-width: 0; display: flex; flex-wrap: wrap; gap: var(--space-1); align-items: center; }
    /* one row, never wraps: search and selects shrink first; quick actions stay last at the right */
    .filters { flex: 1 1 480px; min-width: 0; display: flex; gap: var(--space-2); align-items: center; flex-wrap: nowrap; }
    .grow { flex: 0 1 240px; min-width: 100px; }
    .crumbs > :global(.ui-toolbar) { margin-left: auto; flex-wrap: nowrap; }
    .bulk { gap: var(--space-1); }
    @container hist (max-width: 1100px) { .ql { display: none; } }
    @container hist (max-width: 760px) { .lbl { display: none; } }
    .crumbs :global(.sel-btn) { min-width: 108px; }
    .bulk { display: flex; align-items: center; }
    .bulk.off { visibility: hidden; }
    .sel { flex: 0 1 140px; min-width: 84px; }
    .num { flex: 0 1 108px; min-width: 64px; }
    .lbl, .filters > :global(.ui-toggle), .filters > :global(.ctl) { flex: none; }
    .list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 var(--space-2) var(--space-3); }
    .cell { display: contents; }
    .lbl { white-space: nowrap; font-size: var(--font-size-sm); }
    @media (max-width: 768px), (max-height: 500px) {
        /* don't shrink controls to fit: a crushed stepper can't be tapped */
        .filters { flex: 1 1 auto; flex-wrap: nowrap; gap: var(--space-1); overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; }
        .grow { flex: 0 0 8.5rem; min-width: 8.5rem; max-width: none; }
        .sel { flex: 0 0 7.5rem; min-width: 7.5rem; }
        .num { flex: 0 0 4.75rem; min-width: 4.75rem; }
        .bulk.off { display: none; }
        .crumbs :global(.sel-btn) { min-width: 0; }
    }

</style>
