<script lang="ts">
    import LTrash from '@lucide/svelte/icons/trash-2';
    import LMaximize from '@lucide/svelte/icons/maximize-2';
    import LMinimize from '@lucide/svelte/icons/minimize-2';
    import { toolState } from '../../lib/state/tools.svelte';
    import LImage from '@lucide/svelte/icons/image';
    import LReplace from '@lucide/svelte/icons/replace';
    import LRefresh from '@lucide/svelte/icons/refresh-cw';
    import LPlay from '@lucide/svelte/icons/play';
    import LSave from '@lucide/svelte/icons/save';
    import LOpen from '@lucide/svelte/icons/folder-open';
    import LImport from '@lucide/svelte/icons/file-input';
    import LLoader from '@lucide/svelte/icons/loader-circle';
    import { api, hasPermission } from '../../lib/api/swarm';
    import { resolveUrl } from '../../lib/api/client';
    import { gen } from '../../lib/state/gen.svelte';
    import { cleanModelName, paramState } from '../../lib/state/params.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { userSettings } from '../../lib/state/usersettings.svelte';
    import { buildComfyParams } from '../../lib/util/comfyParams';
    import { hasModelPreview, modelPreviewSrc } from '../../lib/state/models';
    import { Button, Dropdown, EmptyState, FormRow, IconButton, ImageInput, Modal, TextInput, Toggle, VirtualGrid } from '../ui';
    import BrowserCard from '../browser/BrowserCard.svelte';
    import { fileToDataUrl } from '../../lib/util/metadata';
    import { imageToData } from '../../lib/util/civitai';
    import { formatClass, formatLayout } from '../../lib/util/browserFormat';

    let { visible = true }: { visible?: boolean } = $props();
    const canEdit = hasPermission('comfy_edit_workflows');
    const canRead = hasPermission('comfy_read_workflows');
    const canDirect = hasPermission('comfy_direct_calls');
    const gpuOptions = [
        { value: 'none', label: 'Multi-GPU: off' },
        { value: 'all', label: 'Multi-GPU: all' },
        { value: 'reserve', label: 'Multi-GPU: reserve' },
        { value: 'queue', label: 'Multi-GPU: queue' },
    ];
    let frame = $state<HTMLIFrameElement>();
    let gpu = $state(initialGpu());
    let saving = $state(false);
    let browsing = $state(false);
    let saveName = $state('');
    let description = $state('');
    let enableSimple = $state(false);
    let img = $state('');
    let imageData = $state('');
    let workflows = $state<{ name: string; image?: string; description?: string; enable_in_simple?: boolean }[]>([]);
    let replaceName = $state('');

    function initialGpu(): string {
        const v = readCookie('comfy_domulti');
        return v === 'true' ? 'all' : v === 'reserve' || v === 'queue' ? v : 'none';
    }
    function readCookie(name: string): string {
        const key = `${name}=`;
        for (const part of document.cookie.split(';')) {
            const c = part.trim();
            if (c.startsWith(key)) {
                return decodeURIComponent(c.slice(key.length));
            }
        }
        return '';
    }
    function writeCookie(name: string, value: string) {
        const exp = new Date(Date.now() + 365 * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${exp};path=/;SameSite=Lax`;
    }
    function setGpu(v: string) {
        gpu = v;
        if (v === 'none') {
            document.cookie = 'comfy_domulti=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;SameSite=Lax';
        }
        else {
            writeCookie('comfy_domulti', v === 'all' ? 'true' : v);
        }
        reload();
    }

    let ready = $state(false);
    let failed = $state(false);
    let src = $state(resolveUrl('ComfyBackendDirect/'));
    let waitTimer: ReturnType<typeof setInterval> | undefined;
    function onFrameLoad() {
        clearInterval(waitTimer);
        const started = Date.now();
        waitTimer = setInterval(() => {
            const w = frame?.contentWindow as any;
            if (w?.app?.graph && w?.app?.graphToPrompt) {
                clearInterval(waitTimer);
                ready = true;
                fit();
            }
            else if (Date.now() - started > 60000) {
                clearInterval(waitTimer);
                failed = true;
            }
        }, 250);
    }
    function reload() {
        ready = false;
        failed = false;
        info = null;
        src = `${resolveUrl('ComfyBackendDirect/')}?t=${Date.now()}`;
    }
    $effect(() => () => clearInterval(waitTimer));
    // LiteGraph sizes its canvas from the window: re-measure after the pane was hidden (display:none) or resized
    function fit() {
        const w = frame?.contentWindow;
        if (w && ready) w.dispatchEvent(new Event('resize'));
    }
    $effect(() => {
        if (!visible || !ready) return;
        requestAnimationFrame(() => { fit(); frame?.focus(); });
    });
    $effect(() => {
        if (!frame || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => fit());
        ro.observe(frame);
        return () => ro.disconnect();
    });

    function comfyWindow(): any {
        const w = frame?.contentWindow as any;
        if (!w?.app?.graphToPrompt) {
            throw new Error('ComfyUI is still loading.');
        }
        return w;
    }

    let info: Promise<Record<string, any>> | null = null;
    function objectInfo(): Promise<Record<string, any>> {
        return (info ??= fetchObjectInfo());
    }
    async function fetchObjectInfo(): Promise<Record<string, any>> {
        try {
            const res = await fetch(resolveUrl('ComfyBackendDirect/object_info'));
            if (!res.ok) {
                return {};
            }
            return await res.json();
        }
        catch {
            return {};
        }
    }

    async function readGraph(requireSave: boolean) {
        const w = comfyWindow();
        const got = await w.app.graphToPrompt();
        return buildComfyParams({
            workflow: got.workflow,
            prompt: got.output,
            objectInfo: await objectInfo(),
            serverParamIds: paramState.baseParamIds(),
            models: (paramState.models['Stable-Diffusion'] ?? []).map(([name]) => cleanModelName(name)),
            resetBatchSize: `${userSettings.get('resetbatchsizetoone', false)}` === 'true',
            requireSave,
        });
    }

    async function useThis() {
        const built = await readGraph(true);
        paramState.applyComfy(built);
        ui.toast('Generation is using this workflow.', 'success');
    }

    async function importFlow() {
        const data = await api.comfyGetGeneratedWorkflow(gen.currentInput());
        if (!data.workflow) {
            throw new Error('No workflow for the current parameters.');
        }
        const w = comfyWindow();
        if (typeof w.app.loadApiJson !== 'function') {
            throw new Error('This ComfyUI version cannot import API workflows.');
        }
        await w.app.loadApiJson(w.JSON.parse(data.workflow), 'Imported from Generate');
        ui.toast('Imported the current parameters.', 'success');
    }

    async function browse() {
        workflows = (await api.comfyListWorkflows()).workflows ?? [];
        browsing = true;
    }
    async function loadWorkflow(name: string) {
        const data = await api.comfyReadWorkflow(name);
        const w = comfyWindow();
        await w.app.loadGraphData(w.JSON.parse(data.result.workflow));
        browsing = false;
        ui.toast(`Loaded ${name}.`, 'success');
    }
    async function removeWorkflow(name: string) {
        if (!(await ui.ask('Delete workflow?', `Delete ${name}? This cannot be undone.`, { confirmLabel: 'Delete' }))) {
            return;
        }
        await api.comfyDeleteWorkflow(name);
        workflows = workflows.filter(w => w.name !== name);
    }

    async function saveNow() {
        const name = saveName.trim();
        if (!name) {
            throw new Error('Enter a name.');
        }
        const existing = workflows.find(w => w.name.toLowerCase() === name.toLowerCase());
        if (!replaceName && existing && !(await ui.ask('Overwrite workflow?', `Replace ${existing.name}?`, { confirmLabel: 'Overwrite' }))) {
            return;
        }
        // classic: replacing (or renaming while replacing) deletes the old entry after saving the new one
        const replace = replaceName || existing?.name || '';
        const built = await readGraph(false);
        const custom = { ...built.params };
        delete custom.comfyworkflowraw;
        delete custom.comfyworkflowparammetadata;
        await api.comfySaveWorkflow({
            name: replaceName ? name : existing?.name ?? name,
            description,
            enable_in_simple: enableSimple,
            workflow: JSON.stringify(built.workflow),
            prompt: built.promptJson,
            custom_params: JSON.stringify(custom),
            param_values: JSON.stringify(built.paramVal),
            image: imageData,
            replace,
        });
        saving = false;
        replaceName = '';
        ui.toast('Workflow saved.', 'success');
    }
    function replaceWith(w: { name: string; image?: string; description?: string; enable_in_simple?: boolean }) {
        replaceName = w.name;
        saveName = w.name;
        description = w.description ?? '';
        enableSimple = !!w.enable_in_simple;
        img = hasModelPreview(w.image) ? modelPreviewSrc(w.image) : '';
        imageData = '';
        browsing = false;
        saving = true;
    }
    function openSave() {
        replaceName = '';
        saving = true;
    }

    async function onfiles(files: File[]) {
        try {
            const data = await imageToData(await fileToDataUrl(files[0]));
            if (!data) {
                throw new Error('Could not read that image.');
            }
            img = data;
            imageData = data;
        }
        catch (e) {
            ui.error(e);
        }
    }
    async function useCurrent() {
        const src = gen.current?.src;
        if (!src) {
            return;
        }
        const data = await imageToData(src.startsWith('data:') ? src : resolveUrl(src));
        if (!data) {
            throw new Error('Could not read the current image.');
        }
        img = data;
        imageData = data;
    }

    const layout = formatLayout('Small Cards');
</script>

<div class="comfy" class:full={toolState.comfyFull}>
    <div class="bar">
        {#if canDirect}<Button variant="primary" icon={LPlay} disabled={!ready} onclick={useThis}>Use This Workflow</Button>{/if}
        {#if canEdit}<Button icon={LSave} disabled={!ready} onclick={async () => { if (canRead) { try { workflows = (await api.comfyListWorkflows()).workflows ?? []; } catch { /* name check is optional */ } } openSave(); }}>Save</Button>{/if}
        {#if canRead}<Button icon={LOpen} onclick={browse}>Browse</Button>{/if}
        {#if canDirect}<Button icon={LImport} disabled={!ready} onclick={importFlow}>Import From Generate Tab</Button>{/if}
        <div class="gpu"><Dropdown ariaLabel="Multi-GPU" options={gpuOptions} value={gpu} onchange={setGpu} /></div>
        <span class="sp"></span>
        <IconButton variant="primary" icon={toolState.comfyFull ? LMinimize : LMaximize} label={toolState.comfyFull ? 'Exit fullscreen' : 'Fullscreen'} aria-pressed={toolState.comfyFull} onclick={() => toolState.toggleComfyFull()} />
    </div>
    <div class="frame">
        <iframe bind:this={frame} title="ComfyUI" {src} onload={onFrameLoad}></iframe>
        {#if !ready}
            <div class="state">
                {#if failed}
                    <EmptyState title="ComfyUI didn't load" message="Check that a ComfyUI backend is running in Server → Backends, then reload." />
                    <Button icon={LRefresh} onclick={reload}>Reload</Button>
                {:else}
                    <LLoader size={20} class="animate-spin" aria-hidden="true" /><span>Loading ComfyUI…</span>
                {/if}
            </div>
        {/if}
    </div>
</div>

<Modal bind:open={saving} tone="panel" title={replaceName ? `Replace ${replaceName}` : 'Save workflow'} size="md">
    <div class="aha-form ui-dense">
        <FormRow label="Name"><TextInput bind:value={saveName} aria-label="Workflow name" placeholder="folder/name" /></FormRow>
        <FormRow label="Description"><TextInput bind:value={description} aria-label="Description" /></FormRow>
        <FormRow label="Enable in Simple tab" info="Lists this workflow in the Simple tab."><Toggle hideLabel label="Enable in Simple tab" bind:checked={enableSimple} /></FormRow>
        <FormRow label="Preview">
            <div class="preview">
                <ImageInput src={img} label="Preview image" {onfiles} onclear={() => { img = ''; imageData = 'clear'; }} />
                {#if gen.current}<Button icon={LImage} onclick={useCurrent}>Use current image</Button>{/if}
            </div>
        </FormRow>
    </div>
    {#snippet footer()}
        <Button onclick={() => (saving = false)}>Cancel</Button>
        <Button variant="primary" icon={LSave} disabled={!saveName.trim()} onclick={saveNow}>{replaceName ? 'Replace' : 'Save'}</Button>
    {/snippet}
</Modal>
<Modal bind:open={browsing} tone="panel" title="Workflows" size="lg">
    <div class="browse">
        {#if !workflows.length}
            <EmptyState title="No workflows" message="Save one from the editor and it shows up here." />
        {:else}
            <VirtualGrid items={workflows} key={(w) => w.name} {...layout} class={formatClass('Small Cards')} label="Workflows">
                {#snippet item(w)}
                    <BrowserCard src={modelPreviewSrc(w.image)} placeholder="No preview" title={w.name.split('/').pop() ?? w.name} label={w.name} description={w.description ?? ''} onclick={() => { loadWorkflow(w.name).catch(e => ui.error(e)); }}>
                        {#snippet overlay()}
                            {#if canEdit && ready}<IconButton icon={LReplace} label="Replace {w.name} with the current graph" onclick={(e: MouseEvent) => { e.stopPropagation(); replaceWith(w); }} />{/if}
                            {#if canEdit}<IconButton variant="danger" icon={LTrash} label="Delete {w.name}" onclick={(e: MouseEvent) => { e.stopPropagation(); void removeWorkflow(w.name); }} />{/if}
                        {/snippet}
                    </BrowserCard>
                {/snippet}
            </VirtualGrid>
        {/if}
    </div>
</Modal>

<style>
    .comfy { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .bar { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); padding: 0 0 var(--space-1); }
    .gpu { width: 180px; }
    .sp { flex: 1; }
    .full { position: fixed; inset: 0; z-index: 30; padding: var(--space-1); background: var(--color-base); }
    .frame { position: relative; flex: 1; min-height: 240px; border-radius: var(--radius-ui); overflow: hidden; background: var(--color-bg); }
    iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .state { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2);
        background: var(--color-bg); color: var(--color-ink-3); font-size: var(--text-small); }
    .preview { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .browse { height: min(60vh, 520px); overflow: auto; }
</style>
