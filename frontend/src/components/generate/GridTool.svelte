<script lang="ts">
    import LX from '@lucide/svelte/icons/x';
    import LFolder from '@lucide/svelte/icons/folder-output';
    import LSliders from '@lucide/svelte/icons/sliders-horizontal';
    import LAxis from '@lucide/svelte/icons/axis-3d';
    import LSave from '@lucide/svelte/icons/save';
    import LOpen from '@lucide/svelte/icons/folder-open';
    import LTrash from '@lucide/svelte/icons/trash-2';
    import { api, hasPermission, outputPrefix } from '../../lib/api/swarm';
    import { resolveUrl } from '../../lib/api/client';
    import { gen } from '../../lib/state/gen.svelte';
    import { paramState } from '../../lib/state/params.svelte';
    import { toolState } from '../../lib/state/tools.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { Button, Dropdown, FormRow, IconButton, Modal, Section, TextInput, Toggle } from '../ui';

    const OUTPUTS = ['Just Images', 'Grid Image', 'Web Page'].map(v => ({ value: v, label: v }));
    let folderName = $state('grid-[date]-[time]');
    let outputType = $state('Web Page');
    const OPT_IDS = { doOverwrite: 'do-overwrite', fastSkip: 'fast-skip', generatePage: 'generate-page', publishMeta: 'publish-metadata',
        dryRun: 'dry-run', weightOrder: 'weight-order', continueOnError: 'continue-on-error', showOutputs: 'show-outputs' } as const;
    type OptKey = keyof typeof OPT_IDS;
    let opts = $state<Record<OptKey, boolean>>({ doOverwrite: false, fastSkip: false, generatePage: true, publishMeta: true, dryRun: false, weightOrder: true, continueOnError: false, showOutputs: true });
    let axes = $state<{ id: number; mode: string; vals: string }[]>([{ id: 1, mode: '', vals: '' }]);
    let nextId = 2;
    let pageHref = $state('');
    let saving = $state(false);
    let loading = $state(false);
    let saveName = $state('');
    let isPublic = $state(false);
    let setups = $state<{ value: string; label: string }[]>([]);
    let picked = $state('');

    const canRead = hasPermission('gridgen_read_grids');
    const canSave = hasPermission('gridgen_save_grids');
    const excluded = new Set(['images', 'batchsize', 'refinersavebeforerefine']);
    const paramOptions = $derived([
        { value: '', label: 'Parameter…' },
        ...paramState.params.filter(p => !p.extra_hidden && !excluded.has(p.id)).map(p => ({ value: p.id, label: p.name })),
    ]);

    /** classic: a new empty axis row appears once the last one is filled in */
    function ensureTrailing() {
        const last = axes[axes.length - 1];
        if (last?.mode && last.vals.trim()) axes.push({ id: nextId++, mode: '', vals: '' });
    }
    function removeAxis(id: number) {
        axes = axes.filter(a => a.id !== id);
        if (!axes.length) axes = [{ id: nextId++, mode: '', vals: '' }];
    }
    $effect(() => {
        toolState.setRunner(run);
        return () => toolState.setRunner(null);
    });
    const OPTS: { key: OptKey; label: string; info: string }[] = [
        { key: 'doOverwrite', label: 'Overwrite existing files', info: 'If checked, will overwrite any already-generated images.' },
        { key: 'fastSkip', label: 'Fast skip', info: 'If checked, uses faster skipping algorithm (prevents validation of skipped axes).' },
        { key: 'generatePage', label: 'Generate page', info: 'If unchecked, will prevent regenerating the page for the grid.' },
        { key: 'publishMeta', label: 'Publish metadata', info: 'If unchecked, will hide the image generation metadata.' },
        { key: 'dryRun', label: 'Dry run', info: 'If checked, will not actually generate any images - useful to validate your grid.' },
        { key: 'weightOrder', label: 'Allow reordering', info: 'If checked, the grid generator will reorder processing order of axes to maximize generation speed.\nIf unchecked, the topmost axis loops first, then the next axis advances by one and the axis above loops again, etc.' },
        { key: 'continueOnError', label: 'Continue on error', info: 'If checked, failed generations are skipped and the grid continues.' },
        { key: 'showOutputs', label: 'Show outputs', info: 'If checked, shows the images on-page as they come in. If not checked, only the final result is shown.' },
    ];

    function pad(n: number): string {
        return `${n}`.padStart(2, '0');
    }
    function fillPath(template: string): string {
        const d = new Date();
        const put = (s: string, token: string, value: string) => s.split(token).join(value);
        return put(put(put(put(put(put(put(put(template,
            '[date]', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`),
            '[time]', `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`),
            '[year]', `${d.getFullYear()}`),
            '[month]', pad(d.getMonth() + 1)),
            '[day]', pad(d.getDate())),
            '[hour]', pad(d.getHours())),
            '[minute]', pad(d.getMinutes())),
            '[second]', pad(d.getSeconds()));
    }
    function saveConfig() {
        return {
            axes: axes.filter(a => a.mode && a.vals.trim()).map(a => ({ mode: a.mode, values: a.vals })),
            checkboxes: Object.fromEntries((Object.keys(OPT_IDS) as OptKey[]).map(k => [`grid-gen-opt-${OPT_IDS[k]}`, opts[k]])),
            output_folder_name: folderName,
            output_type: outputType,
        };
    }
    function applyConfig(data: any) {
        if (!data) {
            return;
        }
        folderName = data.output_folder_name ?? folderName;
        outputType = data.output_type ?? outputType;
        const c = data.checkboxes ?? {};
        for (const k of Object.keys(OPT_IDS) as OptKey[]) {
            const v = c[`grid-gen-opt-${OPT_IDS[k]}`];
            if (typeof v === 'boolean') opts[k] = v;
        }
        const rows = (data.axes ?? []).filter((a: any) => a?.mode);
        axes = rows.length ? rows.map((a: any) => ({ id: nextId++, mode: `${a.mode}`, vals: `${a.values ?? a.vals ?? ''}` })) : [{ id: nextId++, mode: '', vals: '' }];
    }

    async function run() {
        try {
            const filled = axes.filter(a => a.mode && a.vals.trim());
            if (!filled.length) {
                throw new Error('Add at least one axis.');
            }
            const folder = fillPath(folderName).trim();
            if (!folder) {
                throw new Error('Output folder name is required.');
            }
            if (outputType === 'Web Page') {
                const ex = await api.gridGenDoesExist(folder);
                if (ex.exists && !(await ui.ask('This grid folder already exists', `${folder} already has a grid page. Continue?`, { confirmLabel: 'Continue', danger: false }))) {
                    return;
                }
            }
            pageHref = '';
            const base = gen.currentInput();
            gen.stream(base, (on) => api.gridGenRun({
                baseParams: base,
                gridAxes: filled.map(a => ({ mode: a.mode, vals: a.vals })),
                outputFolderName: folder,
                doOverwrite: opts.doOverwrite, fastSkip: opts.fastSkip, generatePage: opts.generatePage, publishGenMetadata: opts.publishMeta,
                dryRun: opts.dryRun, weightOrder: opts.weightOrder, outputType, continueOnError: opts.continueOnError, showOutputs: opts.showOutputs,
                saveConfig: saveConfig(),
            }, (m) => {
                if (m.success && outputType === 'Web Page') {
                    pageHref = resolveUrl(`${outputPrefix()}/Grids/${folder}/index.html`);
                }
                on(m);
            }));
        }
        catch (e) {
            ui.error(e);
        }
    }

    async function openLoad() {
        const data = await api.gridGenListData();
        setups = [
            ...(data.data ?? []).map(n => ({ value: n, label: n })),
            ...(data.history ?? []).map(n => ({ value: `history/${n}`, label: `History — ${n}` })),
        ];
        picked = setups[0]?.value ?? '';
        loading = true;
    }
    async function loadNow() {
        if (!picked) {
            return;
        }
        if (picked.startsWith('history/')) {
            const res = await fetch(resolveUrl(`${outputPrefix()}/Grids/${picked.slice('history/'.length)}/swarm_save_config.json`));
            if (!res.ok) {
                throw new Error('Could not read that grid.');
            }
            applyConfig(await res.json());
        }
        else {
            applyConfig((await api.gridGenGetData(picked)).data);
        }
        loading = false;
        ui.toast('Grid loaded.', 'success');
    }
    async function deleteSetup() {
        if (!picked || !(await ui.ask('Delete grid setup?', picked, { confirmLabel: 'Delete' }))) {
            return;
        }
        await api.gridGenDeleteData(picked);
        loading = false;
        ui.toast('Grid setup deleted.', 'success');
    }
    async function saveNow() {
        const name = saveName.trim();
        if (!name) {
            throw new Error('Enter a name.');
        }
        await api.gridGenSaveData(name, isPublic, saveConfig());
        saving = false;
        ui.toast('Grid saved.', 'success');
    }
</script>

    <Section icon={LFolder} title="Output">
        <div class="aha-form ui-dense">
            <FormRow label="Folder name" info={'Name of the folder to save this grid under in your History tab.\nYou can use auto-fills [date], [time], [year], [month], [day], [hour], [minute], [second].'}><TextInput bind:value={folderName} aria-label="Output folder name" /></FormRow>
            <FormRow label="Output type" info={'Just Images saves the images only. Grid Image also saves one combined image. Web Page builds an interactive page in the output folder.'}><Dropdown ariaLabel="Output type" options={OUTPUTS} bind:value={outputType} /></FormRow>
        </div>
        {#if pageHref}<p class="aha-muted">Grid page: <a href={pageHref} target="_blank" rel="noreferrer">{pageHref}</a></p>{/if}
    </Section>
    <Section icon={LSliders} title="Options">
        <div class="aha-form ui-dense">
            {#each OPTS as o (o.key)}
                <FormRow label={o.label} info={o.info}><Toggle hideLabel label={o.label} bind:checked={opts[o.key]} /></FormRow>
            {/each}
        </div>
    </Section>
    <Section icon={LAxis} title="Axes">
        {#snippet actions()}
            {#if canSave}<Button icon={LSave} onclick={() => (saving = true)}>Save</Button>{/if}
            {#if canRead}<Button icon={LOpen} onclick={openLoad}>Load</Button>{/if}
        {/snippet}
        <p class="aha-muted">One row per axis. Separate values with commas or <code>||</code>; <code>1, 2, .., 10</code> fills a range, and a <code>SKIP:</code> prefix lists a value without generating it. Run it with the Generate button.</p>
        <div class="axes ui-dense">
            {#each axes as axis (axis.id)}
                <div class="axis">
                    <div class="mode"><Dropdown ariaLabel="Axis parameter" options={paramOptions} bind:value={() => axis.mode, (v: string) => { axis.mode = v; ensureTrailing(); }} searchable /></div>
                    <TextInput aria-label="Axis values" placeholder="1, 2, 3" bind:value={() => axis.vals, (v: string) => { axis.vals = v; ensureTrailing(); }} />
                    <IconButton icon={LX} label="Remove axis" onclick={() => removeAxis(axis.id)} />
                </div>
            {/each}
        </div>
    </Section>

<Modal bind:open={saving} tone="panel" title="Save grid" size="md">
    <div class="aha-form ui-dense">
        <FormRow label="Name"><TextInput bind:value={saveName} aria-label="Grid name" /></FormRow>
        <FormRow label="Share with all users" info="Public grid setups are listed for every user."><Toggle hideLabel label="Share with all users" bind:checked={isPublic} /></FormRow>
    </div>
    {#snippet footer()}
        <Button onclick={() => (saving = false)}>Cancel</Button>
        <Button variant="primary" icon={LSave} disabled={!saveName.trim()} onclick={saveNow}>Save</Button>
    {/snippet}
</Modal>
<Modal bind:open={loading} tone="panel" title="Load grid" size="md">
    {#if setups.length}
        <div class="aha-form ui-dense">
            <FormRow label="Grid setup"><Dropdown ariaLabel="Saved grid" options={setups} bind:value={picked} searchable /></FormRow>
        </div>
    {:else}
        <p class="aha-muted">No saved grids or grid history yet.</p>
    {/if}
    {#snippet footer()}
        {#if canSave && picked && !picked.startsWith('history/')}<Button variant="danger" icon={LTrash} onclick={deleteSetup}>Delete</Button>{/if}
        <span class="sp"></span>
        <Button onclick={() => (loading = false)}>Cancel</Button>
        <Button variant="primary" icon={LOpen} disabled={!picked} onclick={loadNow}>Load</Button>
    {/snippet}
</Modal>

<style>
    .axes { display: flex; flex-direction: column; gap: var(--space-1); }
    .axis { display: flex; gap: var(--space-1); align-items: center; }
    .axis > :global(:nth-child(2)) { flex: 1; min-width: 0; }
    .mode { width: 180px; flex: none; }
    .sp { flex: 1; }
</style>
