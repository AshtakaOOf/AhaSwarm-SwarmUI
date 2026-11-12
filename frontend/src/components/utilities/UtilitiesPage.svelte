<script lang="ts">
    import LEraser from '@lucide/svelte/icons/eraser';
    import LScanSearch from '@lucide/svelte/icons/scan-search';
    import LDatabase from '@lucide/svelte/icons/database-zap';
    import LInfo from '@lucide/svelte/icons/info';
    import LWholeWord from '@lucide/svelte/icons/whole-word';
    import LFileLock from '@lucide/svelte/icons/file-lock';
    import LGitCompare from '@lucide/svelte/icons/git-compare-arrows';
    import LDownload from '@lucide/svelte/icons/download';
    import LLink from '@lucide/svelte/icons/link-2';
    import LCheck from '@lucide/svelte/icons/check';
    import LTriangle from '@lucide/svelte/icons/triangle-alert';
    import LBan from '@lucide/svelte/icons/ban';
    import LLoader from '@lucide/svelte/icons/loader-circle';
    import LChevronLeft from '@lucide/svelte/icons/chevron-left';
    import LChevronRight from '@lucide/svelte/icons/chevron-right';
    import LX from '@lucide/svelte/icons/x';
    import LRotate from '@lucide/svelte/icons/rotate-ccw';
    import LCircleStop from '@lucide/svelte/icons/circle-stop';
    import LShield from '@lucide/svelte/icons/shield-alert';
    import LListChecks from '@lucide/svelte/icons/list-checks';
    import { api, hasPermission } from '../../lib/api/swarm';
    import { paramState } from '../../lib/state/params.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { subPages } from '../../lib/nav';
    import { formatBytes } from '../../lib/util/metadata';
    import { CIVIT, HF, asteriskMatcher, civitParts, civitUrlGuessFor, getCivitaiMetadata, htmlText, imageToData, normalizeCivitai, parseCivitaiUrl, searchCivitaiForHash, type CivitResult } from '../../lib/util/civitai';
    import { FormRow, ProgressPair, Stats, StatusText, TaskCard, Button, Dropdown, IconButton, NumberInput, ParamGroup, ProgressBar, Tabs, TextInput, Textarea, Toggle } from '../ui';

    const can = hasPermission;
    const TABS = subPages('utilities');
    $effect(() => { if (!TABS.some(t => t.id === ui.sub.utilities)) ui.setSub('utilities', 'info'); });
    const TYPES = [{ value: 'Stable-Diffusion', label: 'Base Model' }, { value: 'LoRA', label: 'LoRA' }, { value: 'VAE', label: 'VAE' }, { value: 'Embedding', label: 'Embedding' }, { value: 'ControlNet', label: 'ControlNet' }];
    const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
    const names = (t: string) => (paramState.models[t] ?? []).map(m => m[0]);

    let wiping = $state<string | null>(null);
    async function wipe(type: 'image' | 'model') {
        if (!(await ui.ask(`Reset ${type} metadata?`, `All ${type} metadata datastores are reset and reloaded from the source files. Nothing is removed from the ${type} files themselves. This may take a moment.`, { confirmLabel: 'Reset' }))) return;
        wiping = type;
        try { await api.wipeMetadata(type); if (type === 'model') { await api.triggerRefresh(); await paramState.load(); } ui.toast(`${type === 'image' ? 'Image' : 'Model'} metadata reset.`, 'success'); } catch (e) { ui.error(e); }
        wiping = null;
    }

    let sc = $state({ subtype: 'all', date: 'all', filter: 'all', replace: 'only_missing', name: '' });
    let scan = $state<{ running: number; scanned: number; failed: number; skipped: number; updated: number; total: number; done: boolean } | null>(null);
    let scanStop = false;
    async function runScan() {
        if (!(await ui.ask('Scan Civitai for metadata?', 'This may take a long time, may replace data, and cannot be undone. Keep this page open while it runs. If you edited model metadata by hand, pick "Only missing data" to keep it.', { confirmLabel: 'Start scan' }))) return;
        const types = sc.subtype === 'all' ? Object.keys(paramState.models) : [sc.subtype];
        const match = asteriskMatcher(sc.name);
        const list = types.flatMap(t => names(t).map(n => ({ name: n, type: t }))).filter(k => k.name !== '(None)' && match(k.name));
        scan = { running: 0, scanned: 0, failed: 0, skipped: 0, updated: 0, total: list.length, done: false };
        const s = scan!;
        scanStop = false;
        const now = Date.now(), bad = ['', '(None)', '(Unset)'];
        const one = async (key: { name: string; type: string }) => {
            try {
                const model = (await api.describeModel(key.name, key.type)).model;
                if (sc.date !== 'all' && now - new Date(model.time_created).getTime() > 86400000 * (sc.date === 'week' ? 7 : sc.date === 'month' ? 31 : 1)) { s.skipped++; return; }
                let civ = civitUrlGuessFor(model);
                const f = sc.filter;
                if ((f === 'no_thumbnail' && model.preview_image && model.preview_image !== 'imgs/model_placeholder.jpg') || (f === 'no_description' && !bad.includes((model.description ?? '').trim())) || (f === 'no_author' && model.author) || (f === 'explicit_url' && !civ)) { s.skipped++; return; }
                if (!civ) {
                    if (!model.hash) model.hash = (await api.getModelHash(key.name, key.type)).hash;
                    civ = (await searchCivitaiForHash(model.hash)) ?? '';
                    if (!civ) { s.failed++; return; }
                }
                const [id, vid] = parseCivitaiUrl(civ);
                const r = await getCivitaiMetadata(id, vid, { validateSafe: false });
                if ('error' in r) { s.failed++; return; }
                const img = r.imgUrls[0] ? await imageToData(r.imgUrls[0]) : null;
                const md = r.metadata, before = JSON.stringify(model);
                const placeholder = !model.preview_image || model.preview_image === 'imgs/model_placeholder.jpg';
                const text = (all: boolean) => {
                    for (const [k, m] of [['title', 'title'], ['description', 'description'], ['author', 'author'], ['date', 'date'], ['trigger_phrase', 'trigger_phrase'], ['usage_hint', 'usage_hint']]) model[k] = all ? md[`modelspec.${m}`] || model[k] : model[k] || md[`modelspec.${m}`];
                    if (md['modelspec.tags'] && (all || !model.tags)) model.tags = md['modelspec.tags'].split(',').map(x => x.trim());
                };
                if (sc.replace === 'all') { model.preview_image = img || model.preview_image; text(true); }
                else if (sc.replace === 'only_missing') { if (img && placeholder) model.preview_image = img; text(false); }
                else if (sc.replace === 'only_thumbnail') model.preview_image = img || model.preview_image;
                else text(true);
                s.scanned++;
                if (JSON.stringify(model) === before) return;
                await api.editModelMetadata({
                    model: key.name, subtype: key.type, title: model.title || '', author: model.author || '', type: model.architecture || '', description: model.description || '',
                    standard_width: model.standard_width || 0, standard_height: model.standard_height || 0, date: model.date || '', license: model.license || '', trigger_phrase: model.trigger_phrase || '',
                    usage_hint: model.usage_hint || '', prediction_type: model.prediction_type || '', tags: model.tags ? model.tags.join(', ') : null,
                    preview_image: model.preview_image === 'imgs/model_placeholder.jpg' ? null : model.preview_image, preview_image_metadata: null,
                    is_negative_embedding: model.is_negative_embedding, lora_default_weight: model.lora_default_weight || '', lora_default_confinement: model.lora_default_confinement || '',
                });
                s.updated++;
            }
            catch { s.failed++; }
        };
        for (const k of list) {
            if (scanStop) break;
            while (s.running >= 30) await new Promise(r => setTimeout(r, 200));
            s.running++;
            one(k).finally(() => s.running--);
        }
        while (s.running > 0) await new Promise(r => setTimeout(r, 200));
        s.done = true;
        paramState.load().catch(() => {});
    }

    let clipText = $state(ui.tokenizeText ?? ''), tokens = $state<{ id: number; weight: number; text: string }[]>([]);
    let busy = false, again = false;
    async function tokenize() {
        if (busy) { again = true; return; }
        busy = true;
        try { tokens = clipText ? (await api.tokenizeInDetail(clipText)).tokens ?? [] : []; } catch (e) { ui.error(e); }
        busy = false;
        if (again) { again = false; tokenize(); }
    }
    $effect(() => { if (ui.tokenizeText !== null) { clipText = ui.tokenizeText; ui.tokenizeText = null; tokenize(); } });

    const NATIVE = ['safetensors', 'sft', 'engine', 'gguf'];
    const PTYPES = [{ value: 'Stable-Diffusion', label: 'Models' }, { value: 'LoRA', label: 'LoRAs' }, { value: 'VAE', label: 'VAEs' }, { value: 'Embedding', label: 'Embeddings' }, { value: 'ControlNet', label: 'ControlNets' }];
    const pickleCount = (t: string) => names(t).filter(x => !x.startsWith('backup') && x !== '(None)' && !NATIVE.includes(x.split('.').pop() ?? '')).length;
    let fp16 = $state(true), pickling = $state<string | null>(null), pickleMsg = $state('');
    async function pickle(type: string, label: string) {
        if (!(await ui.ask(`Convert ${label} to safetensors?`, 'Pickle files may contain malicious code: only convert files you trust. The pickles are moved to a "backups" folder and the safetensors files take their place. This can use a lot of disk space temporarily and take a while.', { confirmLabel: 'Convert', danger: false }))) return;
        pickling = type; pickleMsg = 'Running, please wait… (details in the server log)';
        try { await api.pickle2SafeTensor(type, fp16); await api.triggerRefresh(); await paramState.load(); pickleMsg = 'Done!'; } catch (e) { pickleMsg = `Error: ${errMsg(e)}`; }
        pickling = null;
    }

    const sdModels = $derived(names('Stable-Diffusion').filter(m => !m.endsWith('.engine')).map(m => ({ value: m, label: m })));
    let lx = $state({ base: '', other: '', rank: 16, out: '' }), lxProg = $state<{ cur: number; all: number } | null>(null), lxMsg = $state(''), lxState = $state<'idle' | 'run' | 'ok' | 'err'>('idle');
    async function extract() {
        let out = lx.out.replace(/\\/g, '/');
        while (out.includes('//')) out = out.replace(/\/\//g, '/');
        if (out.startsWith('/')) out = out.slice(1);
        out = out.replace(/\.(safetensors|sft|gguf|ckpt)$/, '');
        if (!lx.base || !lx.other || !out) { lxState = 'err'; lxMsg = 'Missing required values, cannot extract.'; return; }
        if (names('LoRA').includes(out) && !(await ui.ask('Overwrite LoRA?', `A LoRA named "${out}" already exists. Overwrite it?`, { confirmLabel: 'Overwrite' }))) return;
        lxProg = { cur: 0, all: 0 }; lxState = 'run'; lxMsg = 'Running, please wait…';
        const h = api.loraExtractionWS({ baseModel: lx.base, otherModel: lx.other, rank: lx.rank, outName: out }, d => {
            if (d.overall_percent) lxProg = { cur: d.current_percent ?? 0, all: d.overall_percent };
            else if (d.success) { lxState = 'ok'; lxMsg = 'Done!'; paramState.load(); }
        });
        h.done.catch(e => { lxState = 'err'; lxMsg = `Error: ${errMsg(e)}`; }).finally(() => (lxProg = null));
    }

    let dl = $state({ url: '', type: 'Stable-Diffusion', name: '', folder: '(None)', newFolder: '' });
    let st = $state<{ kind: 'idle' | 'ok' | 'warn' | 'err' | 'busy'; text: string }>({ kind: 'idle', text: 'Paste a model URL (Civitai, Hugging Face, or a direct .safetensors / .gguf link).' });
    let blocked = $state(true), civ = $state<CivitResult | null>(null), civId = $state<string | null>(null);
    let imgs = $state<string[]>([]), imgIdx = $state(0), shownImg = $state<string | null>(null), imgBusy = $state(false);
    let reqId = 0;
    const folderOpts = $derived.by(() => {
        const set = new Set<string>();
        for (const list of Object.values(paramState.models)) for (const [m] of list) { const p = m.split('/'); for (let i = 1; i < p.length; i++) set.add(p.slice(0, i).join('/')); }
        return [{ value: '(None)', label: '(None)' }, { value: '__new__', label: '(Create new…)' }, ...[...set].sort().map(f => ({ value: f, label: f }))];
    });
    const canDownload = $derived(!blocked && !!dl.url.trim() && !!dl.name.trim() && st.kind !== 'busy');
    function nameFix() { if (dl.name.includes(' ')) dl.name = dl.name.replace(/ /g, '_'); }
    const set = (kind: typeof st.kind, text: string, block = false) => { st = { kind, text }; blocked = block; };
    async function showImg(i: number, rid: number) {
        if (!imgs.length) { shownImg = null; imgBusy = false; return; }
        imgBusy = true;
        imgIdx = (i + imgs.length) % imgs.length;
        const at = imgIdx, u = imgs[at];
        const d = u.startsWith('data:') ? u : await imageToData(u);
        if (rid !== reqId) return;
        if (!d) { imgBusy = false; return; }
        imgs[at] = d;
        if (imgIdx !== at) return;
        if (shownImg === d) imgBusy = false;
        else shownImg = d;
    }
    async function loadCivit(id: string | null, versId: string | null, preloaded: any = null, fileId: string | null = null) {
        const rid = reqId;
        set('busy', 'Loading metadata from the Civitai API…');
        const r = await getCivitaiMetadata(id, versId, { preloaded, fileId });
        if (rid !== reqId) return;
        if ('error' in r) { set('warn', `URL appears to be a Civitai link, but seems to not be valid. Please double-check the link. ${r.error}`); return; }
        civ = r; civId = id ?? `${r.raw.id}`;
        dl.url = r.downloadUrl;
        if (r.modelType) dl.type = r.modelType;
        dl.name = `${r.raw.name} - ${r.version.name}`.replace(/[|\\/:*?"<>,.&![\]()]/g, '-');
        nameFix();
        set('ok', 'URL appears to be a Civitai link, and has been loaded from the Civitai API.');
        imgs = [...r.imgUrls]; shownImg = null; showImg(0, rid);
    }
    async function urlInput() {
        civ = null; imgs = []; shownImg = null; imgBusy = false;
        const rid = ++reqId;
        let url = normalizeCivitai(dl.url);
        if (url !== dl.url) dl.url = url;
        if (/\.(pt|pth|ckpt|bin)$/.test(url)) return set('err', 'URL looks to be a pickle file, cannot download. Only safetensors can be auto-downloaded. Pickle files may contain malware.', true);
        if (url.startsWith(HF)) {
            const parts = url.slice(HF.length).split('/');
            const p = [...parts.slice(0, 4), parts.slice(4).join('/')];
            if (parts.length < 5) return set('err', 'URL appears to be a Hugging Face link, but not a specific file. Please use the path of a specific file inside the repo.', true);
            if (p[4].endsWith('?download=true')) { p[4] = p[4].slice(0, -'?download=true'.length); dl.url = HF + p.join('/'); }
            if (!/\.(safetensors|sft|gguf)$/.test(p[4])) return set('err', 'URL appears to be a Hugging Face link, but not a safetensors file. Only safetensors and GGUF can be auto-downloaded.', true);
            const fname = p.slice(4).join('/').replace(/\.(safetensors|sft|gguf)/g, '');
            if (p[2] === 'blob') { p[2] = 'resolve'; dl.url = HF + p.join('/'); dl.name = fname; nameFix(); return set('ok', 'URL appears to be a Hugging Face link, and has been autocorrected to a download link.'); }
            if (p[2] === 'resolve') { dl.name = fname; nameFix(); return set('ok', 'URL appears to be a valid Hugging Face download link.'); }
            return set('warn', 'URL appears to be a Hugging Face link, but seems to not be valid. Please double-check the link.');
        }
        if (url.startsWith(CIVIT)) {
            const parts = civitParts(url);
            if (parts.length < 3) return set('warn', 'URL appears to be a Civitai link, but not a specific model. Please use the path of a specific model.');
            if (parts[0] === 'models') {
                const [id, vid] = parseCivitaiUrl(url);
                if (!id) return set('warn', 'URL appears to be a Civitai link, but is missing a version ID. Please double-check the link.');
                if (vid) dl.url = `${CIVIT}api/download/models/${vid}`;
                return loadCivit(id, vid);
            }
            if (parts[0] === 'api' && ((parts[1] === 'download' && parts[2] === 'models') || (parts[1] === 'v1' && parts[2] === 'model-versions'))) {
                const vid = (parts[3] || '').split('?')[0];
                set('busy', 'URL appears to be a valid Civitai model-version link. Resolving metadata…');
                const r = await api.forwardMetadataRequest(`${CIVIT}api/v1/model-versions/${vid}`).catch(() => null);
                if (rid !== reqId) return;
                if (!r?.response?.modelId) return set('warn', 'URL appears to be a Civitai model-version link, but could not resolve model metadata from the Civitai API.');
                return loadCivit(`${r.response.modelId}`, vid);
            }
            return set('warn', 'URL appears to be a Civitai link, but seems to not be valid.');
        }
        if (!url.trim()) return set('idle', 'Paste a model URL (Civitai, Hugging Face, or a direct .safetensors / .gguf link).', true);
        if (!/^https?:\/\//.test(url)) return set('err', "URL is not a valid link (should start with 'https://').", true);
        set('warn', 'URL is unrecognized but looks valid. Make sure it is a direct download link, not a web page.');
    }
    type Job = { key: number; name: string; type: string; url: string; image: string | null; metadata: string; bytes: number; prog: { cur: number; all: number } | null; rate: number; state: 'run' | 'ok' | 'err' | 'cancel'; msg: string; auth?: boolean; sock?: WebSocket };
    let jobs = $state<Job[]>([]), jobKey = 0;
    function startDownload() {
        const folder = dl.folder === '__new__' ? dl.newFolder.trim() : dl.folder;
        const name = folder === '(None)' || !folder ? dl.name : `${folder}/${dl.name}`;
        let metadata = civ ? { ...civ.metadata } as Record<string, string> : null;
        if (metadata && shownImg) metadata['modelspec.thumbnail'] = shownImg;
        const kb = Number((civ?.file as { sizeKB?: number } | undefined)?.sizeKB);
        const j: Job = { key: ++jobKey, name, type: dl.type, url: dl.url.trim(), image: shownImg, metadata: metadata ? JSON.stringify(metadata) : '', bytes: kb > 0 ? Math.round(kb * 1024) : 0, prog: null, rate: 0, state: 'run', msg: 'Preparing…' };
        jobs = [j, ...jobs];
        runJob(jobs[0]);
    }
    function runJob(j: Job) {
        j.state = 'run'; j.msg = 'Downloading, please wait…'; j.prog = { cur: 0, all: 0 }; j.auth = false;
        const h = api.modelDownloadWS({ url: j.url, type: j.type, name: j.name, metadata: j.metadata }, d => {
            if (d.overall_percent) { j.prog = { cur: d.current_percent ?? 0, all: d.overall_percent }; j.rate = d.per_second ?? 0; j.msg = `${((d.current_percent ?? 0) * 100).toFixed(1)}%${j.rate ? ` - ${formatBytes(j.rate)}/s` : ''}`; }
            else if (d.success) { j.state = 'ok'; j.msg = ''; paramState.load(); }
        });
        j.sock = h.socket;
        h.done.catch(e => {
            const m = errMsg(e);
            j.state = m === 'Download was cancelled.' ? 'cancel' : 'err';
            j.auth = m.includes('got response code 401') || m.includes('got response code 403');
            j.msg = m === 'Download was cancelled.' ? 'Cancelled.' : `Error: ${m}`;
        }).finally(() => { j.prog = null; j.sock = undefined; });
    }
    function cancelJob(j: Job) { try { j.sock?.send('{ "signal": "cancel" }'); } catch {} }
</script>

<div class="aha-page">
    <Tabs tabs={TABS} value={ui.sub.utilities} onchange={(id: string) => ui.setSub('utilities', id)} label="Utilities" />
    <div class="aha-body aha-secs">
        {#if ui.sub.utilities === 'info'}
            <ParamGroup title="Utilities" icon={LInfo}>
                <p class="aha-muted">General tools: the sub-tabs above, and the quick tools below. Use the chevron next to "Utilities" in the top bar to jump straight to one.</p>
            </ParamGroup>
            {#if can('reset_metadata')}
                <ParamGroup title="Metadata utilities" icon={LDatabase} open={false}>
                    <p class="aha-muted">Resets Swarm's model or image metadata datastores and reloads them from the source files - useful after editing files outside Swarm. It does not change the files themselves.</p>
                    <div class="aha-acts">
                        <Button variant="danger" icon={LEraser} disabled={!!wiping} onclick={() => wipe('image')}>{wiping === 'image' ? 'Resetting…' : 'Reset Image Metadata'}</Button>
                        <Button variant="danger" icon={LEraser} disabled={!!wiping} onclick={() => wipe('model')}>{wiping === 'model' ? 'Resetting…' : 'Reset Model Metadata'}</Button>
                    </div>
                </ParamGroup>
            {/if}
            {#if can('edit_model_metadata')}
                <ParamGroup title="Scan Civitai for metadata" icon={LScanSearch}>
                    <p class="aha-muted">Looks every matching model up on Civitai (by the link in its description, or by file hash) and fills in its title, description, author, date, trigger phrase, tags and thumbnail. <b>No undo</b>: edits apply in bulk.</p>
                    <div class="aha-form ui-dense">
                        <FormRow label="Model sub-type"><Dropdown ariaLabel="Model sub-type" options={[{ value: 'all', label: 'All' }, ...Object.keys(paramState.models).map(k => ({ value: k, label: k }))]} bind:value={sc.subtype} /></FormRow>
                        <FormRow label="Date range"><Dropdown ariaLabel="Date range" options={[{ value: 'all', label: 'All (ignore time)' }, { value: 'today', label: 'Downloaded today (24 hours)' }, { value: 'week', label: 'Downloaded this week (7 days)' }, { value: 'month', label: 'Downloaded this month (31 days)' }]} bind:value={sc.date} /></FormRow>
                        <FormRow label="Filter"><Dropdown ariaLabel="Filter" options={[{ value: 'all', label: 'All' }, { value: 'no_thumbnail', label: 'Only models without a thumbnail' }, { value: 'no_description', label: 'Only models without a description' }, { value: 'no_author', label: 'Only models without an author' }, { value: 'explicit_url', label: 'Only models with a Civitai URL in the description' }]} bind:value={sc.filter} /></FormRow>
                        <FormRow label="Replace"><Dropdown ariaLabel="Replace" options={[{ value: 'only_missing', label: 'Only missing data' }, { value: 'all', label: 'All (replace everything)' }, { value: 'only_thumbnail', label: 'Only the thumbnail image' }, { value: 'only_text', label: 'Only the basic text (e.g. description)' }]} bind:value={sc.replace} /></FormRow>
                        <FormRow label="Filename filter"><TextInput aria-label="Model filename filter" placeholder="e.g. SDXL/*  ('*' is a wildcard, case-insensitive)" bind:value={sc.name} /></FormRow>
                    </div>
                    <div class="aha-acts">
                        <Button variant="primary" icon={LScanSearch} disabled={!!scan && !scan.done} onclick={runScan}>Scan Civitai For Metadata</Button>
                        {#if scan && !scan.done}<Button variant="danger" icon={LCircleStop} onclick={() => (scanStop = true)}>Stop</Button>{/if}
                    </div>
                    {#if scan}
                        {@const left = scan.total - scan.scanned - scan.failed - scan.skipped}
                        {#if !scan.done}<ProgressBar value={scan.total ? (scan.total - left) / scan.total : 1} hideLabel ariaLabel="Scan progress" />{/if}
                        <Stats label="Scan progress" items={[
                            { icon: LLoader, label: 'Running', value: scan.running }, { icon: LCheck, label: 'Scanned', value: scan.scanned }, { icon: LDatabase, label: 'Updated', value: scan.updated },
                            { icon: LTriangle, label: 'Not on Civitai', value: scan.failed }, { icon: LBan, label: 'Skipped', value: scan.skipped }, { icon: LListChecks, label: 'Remaining', value: `${left} / ${scan.total}` },
                        ]} />
                        {#if scan.done}<p class="aha-muted">All scans completed.</p>{/if}
                    {/if}
                </ParamGroup>
            {/if}
            {#if can('use_tokenizer')}
                <ParamGroup title="CLIP tokenizer" icon={LWholeWord}>
                    <p class="aha-muted">Shows how text is split into CLIP tokens (all Stable Diffusion models share this token set): each piece with its numeric ID. Word-end tokens have a bar on the right; weights other than 1 are shown.</p>
                    <Textarea aria-label="Text to tokenize" rows={3} bind:value={clipText} oninput={() => tokenize()} placeholder="Type some text…" />
                    <div class="tokens"><span class="aha-muted cnt">{tokens.length} tokens</span>
                        {#each tokens as t, i (i)}
                            {@const end = t.text.endsWith('</w>')}
                            <span class="tok" class:end>{end ? t.text.slice(0, -4) : t.text}<small>{t.id}{#if Math.abs(t.weight - 1) > 0.001} - <b>{t.weight.toFixed(2)}</b>{/if}</small></span>
                        {/each}
                    </div>
                </ParamGroup>
            {/if}
        {:else if ui.sub.utilities === 'pickle'}
            <ParamGroup title="Pickle to safetensors" icon={LFileLock}>
                <p class="aha-muted"><LShield size={12} /> Pickle files (.pt, .ckpt, .bin) may contain malicious code: only convert files whose source you trust. The pickles are moved to a "backups" folder (delete it once the new files work); conversion can temporarily use a lot of disk space. You can keep using the UI while it runs.</p>
                <Toggle label="Convert to FP16 (saves space with minimal side effects, recommended)" bind:checked={fp16} />
                <table class="aha-tbl">
                    <thead><tr><th>Type</th><th class="num">Pickle files</th><th></th></tr></thead>
                    <tbody>
                        {#each PTYPES as t (t.value)}
                            {@const n = pickleCount(t.value)}
                            <tr><td>{t.label}</td><td class="num">{n}</td><td class="end ui-dense"><Button icon={LFileLock} disabled={!!pickling || n === 0} onclick={() => pickle(t.value, t.label)}>{pickling === t.value ? 'Converting…' : `Convert ${t.label}`}</Button></td></tr>
                        {/each}
                    </tbody>
                </table>
                {#if pickleMsg}<p class="aha-muted">{pickleMsg}</p>{/if}
            </ParamGroup>
        {:else if ui.sub.utilities === 'lora'}
            <ParamGroup title="LoRA extractor" icon={LGitCompare}>
                <p class="aha-muted">Extracts a LoRA from the difference between two models. "Base" is the common base (e.g. SDXL 1.0 Base), "Other" the fine-tune to extract. The closer they are, the simpler the LoRA and the better it works with other models on the same base. Extraction is lossy. Rank sets how much detail is kept: higher means bigger files and only slightly better matching (16 is usually enough).</p>
                <div class="aha-form ui-dense">
                    <FormRow label="Base model"><Dropdown searchable ariaLabel="Base model" options={sdModels} bind:value={lx.base} placeholder="Pick the base model" /></FormRow>
                    <FormRow label="Other model"><Dropdown searchable ariaLabel="Other model" options={sdModels} bind:value={lx.other} placeholder="Pick the fine-tuned model" /></FormRow>
                    <FormRow label="Rank"><NumberInput ariaLabel="Rank" min={1} max={320} step={1} bind:value={lx.rank} /></FormRow>
                    <FormRow label="Save as"><TextInput aria-label="LoRA name" bind:value={lx.out} placeholder="LoRA name (folders with '/')" /></FormRow>
                </div>
                <div class="aha-acts"><Button variant="primary" icon={LGitCompare} disabled={lxState === 'run'} onclick={extract}>Extract LoRA</Button>{#if lxMsg}<span class="state {lxState}">{lxMsg}</span>{/if}</div>
                {#if lxProg}<ProgressPair overall={lxProg.all} current={lxProg.cur} label="Extracting" />{/if}
            </ParamGroup>
        {:else if ui.sub.utilities === 'download'}
            <div class="dlwrap">
                <div class="dlmain">
                    <ParamGroup title="Model downloader" icon={LDownload}>
                        <p class="aha-muted">Downloads a model into Swarm's model folders. Only <code>.safetensors</code> / <code>.gguf</code>. Civitai links load and apply the model's metadata; Hugging Face file links are recognised; anything else must be a direct download link.</p>
                        <div class="aha-form ui-dense">
                            <FormRow icon={LLink} label="URL"><TextInput aria-label="Model URL" placeholder="https://civitai.com/models/… or https://huggingface.co/…/file.safetensors" bind:value={dl.url} oninput={() => urlInput()} autocomplete="off" /></FormRow>
                            <StatusText class="urlstat" tone={st.kind} text={st.text} />
                            {#if civ}
                                <FormRow label="Version"><Dropdown searchable ariaLabel="Civitai version" options={civ.raw.modelVersions.map((v: any) => ({ value: `${v.id}`, label: v.name }))} value={`${civ.version.id}`} onchange={(v: string) => { reqId++; loadCivit(civId, v, civ?.raw); }} /></FormRow>
                                {#if civ.files.length > 1}<FormRow label="File"><Dropdown ariaLabel="File" options={civ.files.map(f => ({ value: f.id, label: f.label }))} value={`${civ.file.id}`} onchange={(v: string) => { reqId++; loadCivit(civId, `${civ?.version.id}`, civ?.raw, v); }} /></FormRow>{/if}
                            {/if}
                            <FormRow label="Model type"><Dropdown ariaLabel="Model type" options={TYPES} bind:value={dl.type} /></FormRow>
                            <FormRow label="Folder">
                                {#if dl.folder === '__new__'}<span class="nf"><TextInput aria-label="New folder" placeholder="New folder" bind:value={dl.newFolder} /><IconButton variant="default" icon={LX} label="Back to the folder list" onclick={() => (dl.folder = '(None)')} /></span>
                                {:else}<Dropdown searchable ariaLabel="Folder" options={folderOpts} bind:value={dl.folder} />{/if}
                            </FormRow>
                            <FormRow label="Save as"><TextInput aria-label="Save as" placeholder="Model name (no extension; '/' for folders)" bind:value={dl.name} oninput={nameFix} autocomplete="off" /></FormRow>
                        </div>
                        <div class="aha-acts"><Button variant="primary" icon={LDownload} disabled={!canDownload} onclick={startDownload}>Download</Button></div>
                    </ParamGroup>
                    {#if civ}
                        <ParamGroup title="Civitai metadata" icon={LInfo}>
                            <div class="civ">
                                <div class="civtext">
                                    <p class="aha-muted">Model {civId} - version {civ.version.id}</p>
                                    <dl>
                                        <dt>Model</dt><dd>{civ.raw.name}</dd>
                                        <dt>Version</dt><dd>{civ.version.name}</dd>
                                        <dt>Base model</dt><dd>{civ.version.baseModel}</dd>
                                        <dt>Date</dt><dd>{civ.version.createdAt ? new Date(civ.version.createdAt).toLocaleString() : ''}</dd>
                                        {#if civ.version.paidAccess?.endsAt && new Date(civ.version.paidAccess.endsAt) > new Date()}<dt class="paid">Paid access</dt><dd class="paid">ends {new Date(civ.version.paidAccess.endsAt).toLocaleString()}</dd>{/if}
                                        {#if civ.version.trainedWords?.length}<dt>Trained words</dt><dd>{civ.version.trainedWords.join('; ')}</dd>{/if}
                                        {#if civ.raw.creator}<dt>Author</dt><dd>{civ.raw.creator.username}</dd>{/if}
                                    </dl>
                                    {#if civ.raw.description}<p class="desc">{htmlText(civ.raw.description)}</p>{/if}
                                    {#if civ.version.description}<p class="desc">{htmlText(civ.version.description)}</p>{/if}
                                </div>
                                {#if imgs.length}
                                    <div class="civimg">
                                        <div class="frame">
                                            {#if shownImg}<img src={shownImg} alt="Civitai preview {imgIdx + 1}" onload={() => (imgBusy = false)} onerror={() => (imgBusy = false)} />{:else}<div class="ph"><LLoader size={16} class="spin" /></div>{/if}
                                        </div>
                                        <div class="loadbar">{#if imgBusy}<ProgressBar hideLabel ariaLabel="Loading preview" />{/if}</div>
                                        {#if imgs.length > 1}<div class="aha-acts nav ui-dense"><IconButton variant="default" icon={LChevronLeft} label="Previous image" onclick={() => showImg(imgIdx - 1, reqId)} /><span class="aha-muted">{imgIdx + 1} / {imgs.length}</span><IconButton variant="default" icon={LChevronRight} label="Next image" onclick={() => showImg(imgIdx + 1, reqId)} /></div>{/if}
                                        <p class="aha-muted">The shown image is saved as the model's thumbnail.</p>
                                    </div>
                                {/if}
                            </div>
                        </ParamGroup>
                    {/if}
                </div>
                {#if jobs.length}
                    <div class="dlside">
                        {#each jobs as j (j.key)}
                            <TaskCard title={j.name} image={j.image} state={j.state} progress={j.state === 'run' && j.prog ? { overall: j.prog.all, current: j.prog.cur } : null} oncancel={j.state === 'run' ? () => cancelJob(j) : undefined} ondismiss={j.state === 'run' ? undefined : () => (jobs = jobs.filter(x => x !== j))}>
                                <div class="dlmeta"><span>{j.state === 'ok' ? (j.bytes ? formatBytes(j.bytes) : '') : j.state === 'run' && j.prog && j.prog.cur > 0 ? `${(j.prog.cur * 100).toFixed(1)}%${j.rate ? ` - ${formatBytes(j.rate)}/s` : ''}` : j.msg}</span><span class="kind">{j.type}</span></div>
                                {#if j.auth}<p class="aha-muted">Set or check your API key under Credentials in the top bar.</p>{:else if j.state === 'err' && !/already exists|Invalid type/.test(j.msg)}<p class="aha-muted">Is the URL correct? Some models need an API key (Credentials in the top bar).</p>{/if}
                                {#snippet actions()}
                                    {#if j.state === 'err' || j.state === 'cancel'}<Button icon={LRotate} onclick={() => runJob(j)}>Retry</Button>{/if}
                                {/snippet}
                            </TaskCard>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .aha-body { max-width: 1100px; container-type: inline-size; }
    .aha-body:has(.dlwrap) { max-width: none; }
    .aha-acts > :global(.ctl-strong) { margin-left: auto; }
    .tokens { display: flex; flex-wrap: wrap; gap: 4px; align-items: flex-start; }
    .cnt { width: 100%; }
    .tok { display: inline-flex; flex-direction: column; align-items: center; padding: 2px 6px; border-radius: var(--radius-sm); background: var(--param-ctl); font-size: 13px; }
    .tok.end { box-shadow: inset -2px 0 0 var(--color-ink-3); }
    .tok small { font-size: 10px; color: var(--color-ink-3); }
    .tok small b { color: var(--color-ink-2); font-weight: 600; }
    .prog { display: flex; flex-direction: column; gap: 2px; }
    .aha-page :global(.st.urlstat) { padding-left: clamp(120px, 28%, 200px); }
    .state { margin: 0; font-size: var(--text-small, 12px); color: var(--color-ink-2); }
    .state.ok { color: var(--color-ok-text); } .state.err { color: var(--color-err-text); } .state.cancel { color: var(--color-warn-text); }
    .nf { display: flex; gap: var(--space-1); }
    .nf > :global(:first-child) { flex: 1; min-width: 0; }
    .dlwrap { display: flex; gap: var(--space-2); align-items: flex-start; width: 100%; }
    .dlmain { flex: 1 1 auto; min-width: 0; max-width: 860px; display: flex; flex-direction: column; gap: var(--space-1); }
    .dlside {
        --card: 260px;
        flex: 0 1 auto;
        min-width: min(100%, var(--card));
        max-width: calc(var(--card) * 3 + var(--space-2) * 2);
        margin-left: auto;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card)), var(--card)));
        justify-content: end;
        align-content: start;
        gap: var(--space-2);
        position: sticky;
        top: 0;
        align-self: flex-start;
    }
    .dlmeta { display: flex; align-items: baseline; gap: var(--space-2); width: 100%; font-size: var(--text-small, 12px); color: var(--color-ink-2); }
    .dlmeta .kind { margin-left: auto; color: var(--color-ink-3); }
    .civ { display: flex; gap: var(--space-3); align-items: flex-start; }
    .civtext { flex: 1; min-width: 0; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px var(--space-3); margin: var(--space-1) 0; font-size: var(--text-ui, 13px); }
    dt { color: var(--color-ink-3); font-size: var(--text-small, 12px); } dd { margin: 0; }
    .paid { color: var(--color-warn-text); }
    .desc { margin: var(--space-1) 0 0; font-size: var(--text-small, 12px); color: var(--color-ink-2); max-height: 9em; overflow: auto; white-space: pre-wrap; }
    .civimg { flex: 0 0 220px; display: flex; flex-direction: column; gap: var(--space-1); align-items: center; }
    .frame { width: 100%; height: 260px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .frame img { max-width: 100%; max-height: 260px; width: auto; height: auto; object-fit: contain; border-radius: var(--radius-sm); }
    .loadbar { width: 100%; height: var(--size-progress); }
    .loadbar :global(.ui-progress) { gap: 0; }
    .ph { width: 100%; height: 100%; display: grid; place-items: center; background: var(--param-ctl); border-radius: var(--radius-sm); color: var(--color-ink-3); }
    .nav { justify-content: center; }
    @container (max-width: 760px) { .dlwrap, .civ { flex-direction: column; } .dlside, .civimg { flex: none; width: 100%; } .aha-page :global(.st.urlstat) { padding-left: 0; } }
</style>
