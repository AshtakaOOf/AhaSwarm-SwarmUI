<script lang="ts">
    import LInfo from '@lucide/svelte/icons/info';
    import LActivity from '@lucide/svelte/icons/activity';
    import LGauge from '@lucide/svelte/icons/gauge';
    import LUsers from '@lucide/svelte/icons/users';
    import LCircleArrowUp from '@lucide/svelte/icons/circle-arrow-up';
    import LPower from '@lucide/svelte/icons/power';
    import LRefresh from '@lucide/svelte/icons/refresh-cw';
    import LRotate from '@lucide/svelte/icons/rotate-ccw';
    import LPlus from '@lucide/svelte/icons/plus';
    import LPencil from '@lucide/svelte/icons/pencil';
    import LTrash from '@lucide/svelte/icons/trash-2';
    import LSave from '@lucide/svelte/icons/save';
    import LX from '@lucide/svelte/icons/x';
    import LOctagonX from '@lucide/svelte/icons/octagon-x';
    import LMemory from '@lucide/svelte/icons/memory-stick';
    import LCpu from '@lucide/svelte/icons/cpu';
    import LUserPlus from '@lucide/svelte/icons/user-plus';
    import LUserX from '@lucide/svelte/icons/user-x';
    import LShield from '@lucide/svelte/icons/shield';
    import LPuzzle from '@lucide/svelte/icons/puzzle';
    import LPackagePlus from '@lucide/svelte/icons/package-plus';
    import LPackageX from '@lucide/svelte/icons/package-x';
    import LPackageCheck from '@lucide/svelte/icons/package-check';
    import LToggleLeft from '@lucide/svelte/icons/toggle-left';
    import LToggleRight from '@lucide/svelte/icons/toggle-right';
    import LServer from '@lucide/svelte/icons/server';
    import LClock from '@lucide/svelte/icons/clock';
    import LHourglass from '@lucide/svelte/icons/hourglass';
    import LLoader from '@lucide/svelte/icons/loader-circle';
    import LBox from '@lucide/svelte/icons/box';
    import LMonitor from '@lucide/svelte/icons/monitor';
    import LUser from '@lucide/svelte/icons/user';
    import LZap from '@lucide/svelte/icons/zap';
    import LCircleCheck from '@lucide/svelte/icons/circle-check';
    import LTriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import { api, hasPermission } from '../../lib/api/swarm';
    import type { BackendInfo } from '../../lib/api/types';
    import { gen } from '../../lib/state/gen.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { getSessionInfo, swarmRoot } from '../../lib/api/client';
    import { formatBytes } from '../../lib/util/metadata';
    import { Section, SettingsSearch, matchesQuery, Stats, CommitList, Grid, Badge, Button, Dropdown, EmptyState, KeyValueList, LogViewer, NumberInput, ParamGroup, ProgressBar, Skeleton, StatusDot, Tabs, TextInput, Toggle, type Status, safeUrl } from '../ui';
    import { classicDoc } from '../../lib/api/classicPage';
    import { subPages } from '../../lib/nav';

    const can = hasPermission;
    const TABS = subPages('server');
    const tab = $derived(TABS.some(t => t.id === ui.sub.server) ? ui.sub.server : 'info');

    async function act(fn: () => Promise<any>, msg: string, after?: () => void) {
        try { await fn(); ui.toast(msg, 'success'); after?.(); }
        catch (e) { ui.error(e); }
    }
    const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

    let res = $state<any>(null), resErr = $state<string | null>(null);
    let users = $state<any[]>([]);
    let updates = $state<any>(null), updatesErr = $state<string | null>(null);
    async function loadInfo() {
        api.getServerResourceInfo().then(r => { res = r; resErr = null; }, e => (resErr = errMsg(e)));
        if (can('read_server_info_panels')) api.listConnectedUsers().then(r => (users = r.users ?? []), () => {});
    }
    type UpdTarget = { id: string; type: 'server' | 'extension' | 'backend'; name: string; title: string; preview: string[] };
    let updSkip = $state<Record<string, boolean>>({});
    const updTargets = $derived.by((): UpdTarget[] => {
        if (!updates) return [];
        const t: UpdTarget[] = [];
        if (updates.server?.count > 0) t.push({ id: 'server', type: 'server', name: 'server', title: `SwarmUI: ${updates.server.count} update${updates.server.count === 1 ? '' : 's'}`, preview: updates.server.preview ?? [] });
        for (const [n, d] of Object.entries<any>(updates.extensions ?? {})) t.push({ id: `ext:${n}`, type: 'extension', name: n, title: `${n}: ${d.count} update${d.count === 1 ? '' : 's'}`, preview: d.preview ?? [] });
        for (const [n, d] of Object.entries<any>(updates.backends ?? {})) t.push({ id: `be:${n}`, type: 'backend', name: n, title: `${n}: ${d.count} update${d.count === 1 ? '' : 's'}`, preview: d.preview ?? [] });
        return t;
    });
    const updPicked = $derived(updTargets.filter(t => !updSkip[t.id]));
    async function checkUpdates(notify = false) {
        updatesErr = null;
        try {
            updates = await api.checkForUpdates();
            updSkip = {};
            if (notify) ui.toast(updTargets.length ? `${updTargets.length} update target${updTargets.length === 1 ? '' : 's'} with pending commits.` : 'Everything is up to date.', 'success');
        }
        catch (e) { updatesErr = errMsg(e); if (notify) ui.error(e); }
    }
    async function updateRestart() {
        if (!(await ui.ask('Update and restart server?', 'SwarmUI will pull updates and restart. Running generations are interrupted and every connected user is disconnected for a moment.', { confirmLabel: 'Update and Restart' }))) return;
        return act(() => api.updateAndRestart({ doUpdateServer: updPicked.some(t => t.type === 'server'), extensionsToUpdate: updPicked.filter(t => t.type === 'extension').map(t => t.name), backendsToUpdate: updPicked.filter(t => t.type === 'backend').map(t => t.name), aggressive: false, force: true }), 'Update started; the server will restart.');
    }
    async function shutdown() {
        if (!(await ui.ask('Shut down the server?', 'This stops SwarmUI completely. Nobody can use it until it is started again on the host machine.', { confirmLabel: 'Shut Down' }))) return;
        return act(() => api.shutdownServer(), 'Server is shutting down.');
    }

    let backends = $state<BackendInfo[]>([]), backendsErr = $state<string | null>(null);
    let types = $state<any[]>([]), addType = $state('');
    let edits = $state<Record<string, { title: string; settings: Record<string, any> }>>({});
    let torch = $state<Record<string, { path: string; version: string; target: string; canUpdate: boolean }>>({});
    async function loadBackends() {
        try { backends = Object.values(await api.listBackends()).filter(b => typeof b === 'object'); backendsErr = null; }
        catch (e) { backendsErr = errMsg(e); }
        if (can('install_features')) api.comfyListTorchInstalls().then(r => {
            const m: typeof torch = {};
            for (const i of r.installs ?? []) for (const id of i.backend_ids ?? []) m[`${id}`] = { path: i.path, version: i.torch_version, target: r.target_torch_version, canUpdate: i.can_update };
            torch = m;
        }, () => {});
    }
    async function loadTypes() {
        if (types.length || !can('add_remove_backends')) return;
        try { types = (await api.listBackendTypes()).list ?? []; addType = types[0]?.id ?? ''; } catch {}
    }
    const typeOf = (b: BackendInfo) => types.find(t => t.id === b.type || t.name === b.type);
    function startEdit(b: BackendInfo) { edits[`${b.id}`] = { title: b.title ?? '', settings: { ...(b.settings ?? {}) } }; loadTypes(); }
    async function saveEdit(b: BackendInfo) {
        const e = edits[`${b.id}`];
        await act(() => api.editBackend(b.id, e.title, e.settings), 'Backend saved.', () => { delete edits[`${b.id}`]; loadBackends(); });
    }
    async function delBackend(b: BackendInfo) {
        if (!(await ui.ask(`Delete backend #${b.id}?`, `"${b.title || b.type}" will be removed from the server's backend list. This cannot be undone.`, { confirmLabel: 'Delete' }))) return;
        return act(() => api.deleteBackend(b.id), 'Backend deleted.', loadBackends);
    }
    async function restartBackend(id: string) {
        if (!(await ui.ask(id === 'all' ? 'Restart all backends?' : `Restart backend #${id}?`, 'Running generations on the backend are interrupted and models need to load again.', { confirmLabel: 'Restart' }))) return;
        return act(() => api.restartBackends(id), id === 'all' ? 'Restarting all backends.' : 'Restarting backend.', loadBackends);
    }
    function dotFor(st: string | undefined): Status {
        switch (st) {
            case 'running': return 'success';
            case 'loading': case 'waiting': return 'queued';
            case 'errored': case 'error': return 'error';
            case 'disabled': return 'offline';
            case undefined: return 'idle';
            default: return 'warning';
        }
    }

    let userList = $state<string[]>([]), roles = $state<Record<string, any>>({}), usersErr = $state<string | null>(null);
    let picked = $state<string | null>(null), pickedInfo = $state<any>(null);
    let nu = $state({ name: '', password: '', role: 'user' });
    async function loadUsers() {
        try { userList = (await api.adminListUsers()).users ?? []; roles = (await api.adminListRoles()).roles ?? {}; usersErr = null; }
        catch (e) { usersErr = errMsg(e); }
    }
    async function pick(u: string) { picked = u; pickedInfo = null; pickedInfo = await api.adminGetUserInfo(u).catch(() => null); }
    async function addUser() {
        if (!nu.name.trim() || nu.password.length < 8) { ui.toast('Enter a user name and a password of at least 8 characters.', 'warning'); return; }
        await act(() => api.adminAddUser(nu.name.trim(), nu.password, nu.role), `User ${nu.name} added.`, () => { nu = { name: '', password: '', role: nu.role }; loadUsers(); });
    }
    async function delUser(u: string) {
        if (!(await ui.ask(`Delete user "${u}"?`, 'The account and its settings are removed. Their output images stay on disk.', { confirmLabel: 'Delete' }))) return;
        act(() => api.adminDeleteUser(u), `User ${u} deleted.`, () => { picked = null; loadUsers(); });
    }

    type Ext = { name: string; version: string; tags: string; author: string; desc: string; url: string; license: string; actions: string[]; arg: string };
    let installed = $state<Ext[]>([]), available = $state<Ext[]>([]), extErr = $state<string | null>(null), extLoaded = $state(false), showHidden = $state(false);
    let extEnabled = $state<Record<string, boolean>>({}), extQuery = $state('');
    const extShown = (list: (Ext & { hidden?: boolean })[]) => list.filter(x => (showHidden || !x.hidden) && matchesQuery(extQuery, x.name, x.tags, x.author, x.desc, x.license));
    const extCount = $derived(extShown(installed).length + extShown(available).length);
    async function setExtEnabled(x: Ext, on: boolean) {
        if (!(await extAction(x, on ? 'Enable' : 'Disable'))) extEnabled[x.name] = !on;
    }
    async function loadExtensions() {
        try {
            const doc = await classicDoc(extLoaded);
            const pane = doc.getElementById('Server-Extensions');
            const read = (table: Element | null | undefined, hasVersion: boolean): Ext[] => [...(table?.querySelectorAll('tr') ?? [])].slice(1).map(tr => {
                const td = [...tr.querySelectorAll('td')];
                const c = (i: number) => td[i]?.textContent?.trim() ?? '';
                const btns = [...tr.querySelectorAll('button')];
                const arg = /\('([^']+)'/.exec(btns[0]?.getAttribute('onclick') ?? '')?.[1] ?? c(0);
                const o = hasVersion ? 0 : -1;
                return { name: c(0), version: hasVersion ? c(1) : '', tags: c(2 + o), author: c(3 + o), desc: c(4 + o), url: td[5 + o]?.querySelector('a')?.getAttribute('href') ?? '', license: c(6 + o), actions: btns.map(b => b.textContent?.trim() ?? ''), arg, hidden: tr.classList.contains('extension-hidden-row') } as Ext & { hidden: boolean };
            }).filter(e => e.name);
            const tables = pane?.querySelectorAll('table.simple-table');
            installed = read(tables?.[0], true);
            extEnabled = Object.fromEntries(installed.filter(x => x.actions.includes('Enable') || x.actions.includes('Disable')).map(x => [x.name, x.actions.includes('Disable')]));
            available = read(pane?.querySelector('#available_extensions_table'), false);
            extErr = pane ? null : 'The classic page did not include the extensions list (missing permission?).';
        }
        catch (e) { extErr = errMsg(e); }
        extLoaded = true;
    }
    async function extAction(e: Ext, a: string) {
        const n = e.arg;
        const dangerous: Record<string, [string, string, () => Promise<any>]> = {
            Install: [`Install "${e.name}"?`, `Downloads and installs the extension from ${e.url || 'its repository'}. Extensions run code on the server; only install ones you trust. A restart is needed afterwards.`, () => api.installExtension(n)],
            Uninstall: [`Uninstall "${e.name}"?`, 'Removes the extension folder from the server. A restart is needed afterwards.', () => api.uninstallExtension(n)],
            Update: [`Update "${e.name}"?`, 'Pulls the latest version of the extension. A restart is needed afterwards.', () => api.updateExtension(n)],
            Disable: [`Disable "${e.name}"?`, 'The extension stops loading after the next restart.', () => api.setExtensionEnabled(n, false)],
            Enable: [`Enable "${e.name}"?`, 'The extension loads after the next restart.', () => api.setExtensionEnabled(n, true)],
        };
        const d = dangerous[a];
        if (!d || !(await ui.ask(d[0], d[1], { confirmLabel: a, danger: a !== 'Enable' }))) return false;
        await act(d[2], `${a}: ${e.name} done. Restart the server to apply.`, loadExtensions);
        return true;
    }

    let logs = $state.raw<{ t: string; type: string; msg: string }[]>([]), logsErr = $state<string | null>(null);
    let logTypes = $state<string[]>(['Info', 'Init', 'Warning', 'Error']), logLevel = $state('Info'), logFilter = $state('');
    async function loadLogs() {
        try {
            if (logTypes.length <= 4) api.listLogTypes().then(r => { const n = (r.types_available ?? []).map(t => t.name); if (n.length) logTypes = n; }).catch(() => {});
            const wanted = logTypes.slice(Math.max(0, logTypes.indexOf(logLevel)));
            const data = await api.listRecentLogMessages(wanted);
            const all: { seq: number; t: string; type: string; msg: string }[] = [];
            for (const [type, list] of Object.entries<any>(data.data ?? {})) for (const m of list) all.push({ seq: Number(m.sequence_id ?? 0), t: m.time ?? m.timestamp ?? '', type, msg: m.message });
            logs = all.sort((a, b) => a.seq - b.seq).slice(-600);
            logsErr = null;
        }
        catch (e) { logsErr = errMsg(e); }
    }
    const shownLogs = $derived(logs.filter(l => !logFilter || l.msg.toLowerCase().includes(logFilter.toLowerCase())));

    function refresh() {
        if (tab === 'info') loadInfo();
        else if (tab === 'backends') loadBackends();
        else if (tab === 'logs') loadLogs();
    }
    $effect(() => {
        if (ui.page !== 'server') return;
        const t = tab;
        if (t === 'backends') loadTypes();
        else if (t === 'users') loadUsers();
        else if (t === 'extensions' && !extLoaded) loadExtensions();
        else if (t === 'info' && !updates && can('restart')) checkUpdates();
        refresh();
        const iv = setInterval(() => { if (!document.hidden) refresh(); }, 5000);
        return () => clearInterval(iv);
    });
    const s = $derived(gen.status);
    const session = getSessionInfo();
</script>

<div class="aha-page">
    <Tabs tabs={TABS} value={tab} onchange={(id: string) => ui.setSub('server', id)} label="Server sections" />
    <div class="aha-body aha-secs" class:wide={tab === 'backends'}>
        {#if tab === 'info'}
            <Grid cols={2} min="380px" label="Server Manager">
            <Section icon={LActivity} title="Status">
                {#snippet actions()}<span class="grow"></span><StatusDot status={dotFor(s?.backend_status?.status)} label={s?.backend_status?.status ?? 'unknown'} showLabel />{/snippet}
                {#if s?.backend_status?.message}<p class="aha-muted">{s.backend_status.message}</p>{/if}
                <Stats variant="tiles" label="Server status" items={[
                    { icon: LZap, label: 'Live', value: s?.status?.live_gens }, { icon: LHourglass, label: 'Waiting', value: s?.status?.waiting_gens },
                    { icon: LLoader, label: 'Loading models', value: s?.status?.loading_models }, { icon: LServer, label: 'Waiting for backend', value: s?.status?.waiting_backends },
                ]} />
                <KeyValueList dense label="Server" items={[{ key: 'SwarmUI version', value: session?.version ?? '?', mono: true }, { key: 'Signed in as', value: session?.user_id ?? '?' }]} />
            </Section>
            <Section icon={LGauge} title="Resource usage">
                {#if resErr}<p class="aha-muted">{resErr}</p>{:else if res}
                    <div class="meters">
                        <ProgressBar value={res.cpu?.usage ?? 0} showValue label="CPU" detail="{res.cpu?.cores ?? '?'} cores" />
                        <ProgressBar value={res.system_ram?.used ?? 0} max={res.system_ram?.total || 1} showValue label="System RAM" detail="{formatBytes(res.system_ram?.used)} / {formatBytes(res.system_ram?.total)}" />
                    </div>
                    {#each Object.values<any>(res.gpus ?? {}) as g (g.id)}
                        <div class="gpu" role="group" aria-label="GPU {g.id}">
                            <div class="gpu-h"><LMonitor size={14} aria-hidden="true" /><span class="gpu-n" title={g.name}>GPU {g.id} · {g.name}</span>{#if g.temperature != null}<Badge label="{g.temperature}°C" tone={g.temperature >= 85 ? 'danger' : g.temperature >= 75 ? 'warning' : 'neutral'} />{/if}</div>
                            <div class="meters">
                                <ProgressBar value={g.used_memory} max={g.total_memory || 1} showValue label="VRAM" detail="{formatBytes(g.used_memory)} / {formatBytes(g.total_memory)}" />
                                <ProgressBar value={g.utilization_gpu ?? 0} max={100} showValue label="Utilization" />
                            </div>
                        </div>
                    {/each}
                {:else}<Skeleton lines={2} label="Loading resources" />{/if}
            </Section>
            {#if can('read_server_info_panels')}
                {@const withSessions = users.some(u => (u.active_sessions ?? []).length)}
                <Section icon={LUsers} title="Connected users">
                    {#if users.length}
                        <table class="aha-tbl">
                            <thead><tr><th>User</th><th>Last active</th>{#if withSessions}<th>Sessions</th>{/if}<th class="num">Live</th><th class="num">Waiting</th></tr></thead>
                            <tbody>
                                {#each users as u (u.id)}<tr><td>{u.id}</td><td class="aha-muted">{u.last_active}</td>{#if withSessions}<td>{(u.active_sessions ?? []).map((x: any) => `${x.count}× ${x.address}`).join(', ') || '-'}</td>{/if}<td class="num">{u.live_gens ?? 0}</td><td class="num">{u.waiting_gens ?? 0}</td></tr>{/each}
                            </tbody>
                        </table>
                    {:else}<p class="aha-muted">No users connected.</p>{/if}
                </Section>
            {/if}
            <Section icon={LPower} title="Actions" class="aha-span">
                <div class="act-rows">
                    <div class="act-row"><div class="act-t"><span>Generations and memory</span><span class="aha-muted">Stop your running generations, or unload models from the backends.</span></div>
                        <div class="aha-acts ui-dense">
                            {#if can('control_mem_clean')}
                                <Button icon={LMemory} onclick={() => act(() => api.freeBackendMemory(false), 'VRAM freed.')}>Free VRAM</Button>
                                <Button icon={LMemory} onclick={() => act(() => api.freeBackendMemory(true), 'VRAM + RAM freed.')}>Free VRAM + RAM</Button>
                            {/if}
                            <Button variant="danger" icon={LOctagonX} onclick={() => act(() => gen.interrupt(true), 'Interrupted all your generations.')}>Interrupt all my generations</Button>
                        </div>
                    </div>
                    {#if can('restart')}
                        <div class="act-row"><div class="act-t"><span>Updates</span>
                            {#if updatesErr}<span class="aha-muted">{updatesErr}</span>{:else if !updates}<span class="aha-muted">Checking for updates…</span>{:else if !updTargets.length}<span class="aha-muted">No updates available.</span>{:else}
                                <span class="aha-muted">{updTargets.length} with pending commits; untick what to skip.</span>{/if}</div>
                            <div class="aha-acts ui-dense">
                                <Button icon={LRefresh} onclick={() => checkUpdates(true)}>Check again</Button>
                                <Button variant="danger" icon={LCircleArrowUp} disabled={!updPicked.length} onclick={updateRestart}>Update and Restart Server</Button>
                            </div>
                            {#if updTargets.length}
                                <div class="upd">
                                    {#each updTargets as t (t.id)}
                                        <div class="upd-t">
                                            <Toggle size="sm" label={t.title} checked={!updSkip[t.id]} onchange={(v: boolean) => (updSkip[t.id] = !v)} />
                                            <CommitList lines={t.preview} label="{t.name} pending commits" />
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                    {#if can('shutdown')}
                        <div class="act-row"><div class="act-t"><span>Shutdown</span><span class="aha-muted">Stops the SwarmUI server process.</span></div>
                            <div class="aha-acts ui-dense"><Button variant="danger" icon={LPower} onclick={shutdown}>Shut Down Server</Button></div>
                        </div>
                    {/if}
                </div>
            </Section>
            </Grid>
        {:else if tab === 'backends'}
            {#if backendsErr}<EmptyState icon={LTriangleAlert} title="Couldn't load backends" message={backendsErr} />{/if}
            <div class="aha-acts ui-dense">
                {#if can('restart_backends')}<Button variant="danger" icon={LRotate} onclick={() => restartBackend('all')}>Restart all backends</Button>{/if}
                <Button icon={LRefresh} onclick={loadBackends}>Refresh</Button>
                {#if can('add_remove_backends') && types.length}
                    <span class="sp"></span>
                    <div class="sel"><Dropdown ariaLabel="Backend type" options={types.map(t => ({ value: t.id, label: t.name }))} bind:value={addType} /></div>
                    <Button variant="primary" icon={LPlus} onclick={() => act(() => api.addNewBackend(addType), 'Backend added.', loadBackends)}>Add backend</Button>
                {/if}
            </div>
            <Grid cols={3} min="380px" label="Backends">
            {#each backends as b (b.id)}
                {@const e = edits[`${b.id}`]}
                <ParamGroup icon={LServer} title="#{b.id} {b.title || b.type}" open={!!e} toggleable enabled={b.enabled}
                    onenable={(en: boolean) => act(() => api.toggleBackend(b.id, en), en ? 'Backend enabled.' : 'Backend disabled.', loadBackends)}>
                    {#snippet actions()}<span class="be-meta"><StatusDot status={dotFor(b.status)} label={b.status} showLabel /><Badge label={b.type} /></span>{/snippet}
                    {#if e}
                        <div class="form ui-dense">
                            <label class="frow"><span>Title</span><TextInput aria-label="Title" bind:value={e.title} /></label>
                            {#each Object.keys(e.settings) as k (k)}
                                {@const def = typeOf(b)?.settings?.find((x: any) => x.name.toLowerCase() === k.toLowerCase())}
                                <div class="frow"><span>{k}</span>
                                    {#if typeof e.settings[k] === 'boolean'}<Toggle hideLabel label={k} bind:checked={e.settings[k]} />
                                    {:else if typeof e.settings[k] === 'number'}<NumberInput ariaLabel={k} bind:value={e.settings[k]} />
                                    {:else}<TextInput aria-label={k} type={def?.is_secret ? 'password' : 'text'} value={`${e.settings[k] ?? ''}`} oninput={(v: string) => (e.settings[k] = v)} />{/if}
                                </div>
                            {/each}
                        </div>
                        <div class="aha-acts ui-dense"><Button variant="primary" icon={LSave} onclick={() => saveEdit(b)}>Save</Button><Button icon={LX} onclick={() => delete edits[`${b.id}`]}>Cancel</Button></div>
                    {:else}
                        {@const tv = torch[`${b.id}`]}
                        <KeyValueList dense label="Backend {b.id}" items={[
                            ...(b.current_model ? [{ key: 'Loaded model', value: b.current_model, mono: true }] : []),
                            ...(tv ? [{ key: 'PyTorch', value: tv.canUpdate ? `${tv.version} (${tv.target} available)` : tv.version, mono: true }, { key: 'ComfyUI install', value: tv.path, mono: true }] : []),
                            { key: 'Features', value: (b.features ?? []).join(', ') || null },
                            ...Object.entries(b.settings ?? {}).map(([k, v]) => ({ key: k, value: typeof v === 'object' ? JSON.stringify(v) : `${v}` })),
                        ]} />
                        <div class="aha-acts ui-dense">
                            {#if can('edit_backends')}<Button icon={LPencil} onclick={() => startEdit(b)}>Edit</Button>{/if}
                            {#if can('restart_backends')}<Button variant="danger" icon={LRotate} onclick={() => restartBackend(`${b.id}`)}>Restart</Button>{/if}
                            {#if can('add_remove_backends')}<Button variant="danger" icon={LTrash} onclick={() => delBackend(b)}>Delete</Button>{/if}
                        </div>
                    {/if}
                </ParamGroup>
            {:else}
                {#if !backendsErr}<EmptyState icon={LInfo} title="No backends registered" message={types.length ? 'Pick a backend type above and press Add backend.' : 'You need the add_remove_backends permission to add one.'} />{/if}
            {/each}
            </Grid>
        {:else if tab === 'users'}
            {#if usersErr}<EmptyState icon={LTriangleAlert} title="Couldn't load users" message={usersErr} />{/if}
            <div class="users">
                <div class="ulist">
                    {#each userList as u (u)}<button class="urow" class:on={picked === u} onclick={() => pick(u)}>{u}</button>{/each}
                    <Section dense icon={LUserPlus} title="Add user">
                        <TextInput aria-label="New user name" placeholder="User name" bind:value={nu.name} />
                        <TextInput aria-label="New user password" type="password" placeholder="Password (8+ characters)" bind:value={nu.password} />
                        <Dropdown ariaLabel="Role" options={Object.entries(roles).map(([id, r]) => ({ value: id, label: r.name ?? id }))} bind:value={nu.role} />
                        <Button variant="primary" icon={LUserPlus} onclick={addUser}>Add user</Button>
                    </Section>
                </div>
                <div class="udetail">
                    {#if picked}
                        <Section icon={LUser} plain title={picked}>
                            {#if pickedInfo}<KeyValueList dense label="User info" items={[{ key: 'Roles', value: (pickedInfo.roles ?? []).join(', ') || '-' }, { key: 'Password set by admin', value: `${!!pickedInfo.password_set_by_admin}` }]} />{:else}<Skeleton lines={2} label="Loading user" />{/if}
                            <div class="aha-acts ui-dense"><Button variant="danger" icon={LUserX} disabled={picked === session?.user_id} title={picked === session?.user_id ? "You can't delete yourself" : ''} onclick={() => picked && delUser(picked)}>Delete user</Button></div>
                        </Section>
                    {:else}<EmptyState icon={LInfo} title="Pick a user" message="Select a user on the left to see their details." />{/if}
                    <Section icon={LShield} title="Roles">
                        <KeyValueList dense label="Roles" items={Object.entries(roles).map(([id, r]) => ({ key: r.name ?? id, value: `${(r.permissions ?? []).length} permissions${r.description ? ' - ' + r.description : ''}` }))} />
                    </Section>
                </div>
            </div>
        {:else if tab === 'extensions'}
            {#if extErr}<EmptyState icon={LTriangleAlert} title="Couldn't load extensions" message={extErr} />{:else if !extLoaded}<Skeleton lines={4} label="Loading extensions" />{:else}
                <div class="aha-acts ui-dense">
                    <div class="filter"><SettingsSearch bind:value={extQuery} count={extCount} placeholder="Search extensions…" label="Search extensions" /></div>
                    <Toggle label="Show hidden" bind:checked={showHidden} /><span class="sp"></span><Button icon={LRefresh} onclick={loadExtensions}>Refresh</Button>
                </div>
                {#each [['Installed', installed], ['Available', available]] as [title, list] (title)}
                    <Section icon={title === 'Installed' ? LPackageCheck : LPuzzle} title="{title} extensions">
                        <table class="aha-tbl">
                            <thead><tr><th>Name</th>{#if title === 'Installed'}<th>Version</th>{/if}<th>Author</th><th>Description</th><th>License</th><th></th></tr></thead>
                            <tbody>
                                {#each extShown(list as (Ext & { hidden?: boolean })[]) as x (x.name)}
                                    <tr>
                                        <td>{#if safeUrl(x.url)}<a href={safeUrl(x.url)} target="_blank" rel="noopener noreferrer">{x.name}</a>{:else}{x.name}{/if}{#if x.tags}<div class="aha-muted small">{x.tags}</div>{/if}</td>
                                        {#if title === 'Installed'}<td><code>{x.version}</code></td>{/if}
                                        <td>{x.author}</td><td class="desc">{x.desc}</td><td>{x.license}</td>
                                        <td class="btns ui-dense">{#if x.name in extEnabled}<Toggle hideLabel label="{x.name} enabled" title={extEnabled[x.name] ? 'Enabled (loads on restart)' : 'Disabled'} bind:checked={extEnabled[x.name]} onchange={(on: boolean) => setExtEnabled(x, on)} />{/if}{#each x.actions.filter(a => a !== 'Enable' && a !== 'Disable') as a (a)}<Button variant={a === 'Uninstall' || a === 'Disable' ? 'danger' : a === 'Install' ? 'primary' : 'default'} icon={a === 'Install' ? LPackagePlus : a === 'Uninstall' ? LPackageX : a === 'Update' ? LCircleArrowUp : a === 'Disable' ? LToggleLeft : a === 'Enable' ? LToggleRight : undefined} onclick={() => extAction(x, a)}>{a}</Button>{/each}</td>
                                    </tr>
                                {:else}<tr><td colspan="6" class="aha-muted">{extQuery.trim() ? 'No matches.' : 'None.'}</td></tr>{/each}
                            </tbody>
                        </table>
                    </Section>
                {/each}
            {/if}
        {:else if tab === 'logs'}
            {#if logsErr}<EmptyState icon={LTriangleAlert} title="Couldn't load logs" message={logsErr} />{/if}
            <div class="aha-acts ui-dense">
                <span class="aha-muted">View</span><div class="sel"><Dropdown ariaLabel="Minimum log level" options={logTypes.map(t => ({ value: t, label: t }))} bind:value={logLevel} onchange={() => loadLogs()} /></div>
                <div class="filter"><TextInput type="search" aria-label="Filter logs" placeholder="Filter" bind:value={logFilter} /></div>
                <Button icon={LRefresh} onclick={loadLogs}>Refresh</Button>
            </div>
            <LogViewer label="Server log" wrap height="calc(100vh - 200px)" lines={shownLogs.map(l => `[${l.t}] [${l.type}] ${l.msg}`)} />
        {/if}
    </div>
</div>

<style>
    .aha-body:not(.wide) { max-width: 1400px; }
    .sp { flex: 1; }
    .be-meta { display: inline-flex; align-items: center; gap: var(--space-2); flex: none; text-transform: none; }
    .sel { width: 200px; }
    .filter { width: 240px; }
    .meters { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-2) var(--space-4, 16px); }
    .gpu { display: flex; flex-direction: column; gap: var(--space-1); margin-top: var(--space-2); }
    .gpu-h { display: flex; align-items: center; gap: var(--space-1); min-width: 0; color: var(--color-ink-3); font-size: var(--text-small, 12px); }
    .gpu-n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-ink); font-size: var(--text-ui, 13px); }
    .act-rows { display: flex; flex-direction: column; }
    .act-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-1) var(--space-4, 16px); padding: var(--space-2) 0; }
    .act-row + .act-row { border-top: 1px solid var(--param-panel-bg); }
    .act-row:first-child { padding-top: 0; }
    .act-row:last-child { padding-bottom: 0; }
    .act-t { display: flex; flex-direction: column; min-width: 0; flex: 1 1 260px; font-size: var(--text-ui, 13px); }
    .act-t > .aha-muted { font-size: var(--text-small, 12px); }
    .act-row > .aha-acts { justify-content: flex-end; }
    .upd { flex: 1 1 100%; display: flex; flex-direction: column; gap: var(--space-2); }
    .upd-t { display: flex; flex-direction: column; gap: 2px; }
    .small { font-size: 11px; }
    .aha-tbl .desc { color: var(--color-ink-2); max-width: 420px; }
    .aha-tbl .btns { white-space: nowrap; display: flex; align-items: center; gap: var(--space-2); justify-content: flex-end; }
    .form { display: flex; flex-direction: column; gap: 2px; }
    .frow { display: flex; align-items: center; gap: var(--space-2); }
    .frow > span { flex: 0 0 30%; font-size: var(--text-small, 12px); color: var(--color-ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .frow > :global(:not(span)) { flex: 1; min-width: 0; }
    .users { display: flex; gap: var(--space-2); align-items: flex-start; }
    .ulist { flex: 0 0 240px; display: flex; flex-direction: column; gap: 2px; }
    .urow { text-align: left; height: 28px; padding: 0 var(--space-2); border-radius: var(--radius-sm); color: var(--color-ink-2); }
    .urow:hover { background: var(--color-hover); color: var(--color-ink); }
    .urow.on { background: var(--color-active); color: var(--color-ink); }
    .ulist :global(.aha-sec) { margin-top: var(--space-2); }
    .udetail { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
    @media (max-width: 640px) { .users { flex-direction: column; } .ulist { flex: none; width: 100%; } }
</style>
