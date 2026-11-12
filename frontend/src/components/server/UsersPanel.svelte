<script lang="ts">
    import LInfo from '@lucide/svelte/icons/info';
    import LUser from '@lucide/svelte/icons/user';
    import LUsers from '@lucide/svelte/icons/users';
    import LUserPlus from '@lucide/svelte/icons/user-plus';
    import LUserX from '@lucide/svelte/icons/user-x';
    import LShield from '@lucide/svelte/icons/shield';
    import LShieldPlus from '@lucide/svelte/icons/shield-plus';
    import LShieldX from '@lucide/svelte/icons/shield-x';
    import LKey from '@lucide/svelte/icons/key-round';
    import LMail from '@lucide/svelte/icons/mail';
    import LVenetian from '@lucide/svelte/icons/venetian-mask';
    import LLock from '@lucide/svelte/icons/lock';
    import LSave from '@lucide/svelte/icons/save';
    import LUndo from '@lucide/svelte/icons/undo-2';
    import LTriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import { api, hasPermission } from '../../lib/api/swarm';
    import type { AdminPermission, AdminRole } from '../../lib/api/types';
    import { getSessionInfo } from '../../lib/api/client';
    import { ui } from '../../lib/state/ui.svelte';
    import { prehashPassword } from '../../lib/util/password';
    import { Badge, Button, Dropdown, EmptyState, FormRow, KeyValueList, Modal, NumberInput, ParamGroup, Section, SettingsSearch, Skeleton, SwitchRow, Textarea, TextInput, Toggle, matchesQuery } from '../ui';
    import SettingsTree from '../settings/SettingsTree.svelte';

    // editing these from a browser can lock everyone out, so the ui treats them as read-only
    const LOCAL_USER = 'local';
    const OWNER_ROLE = 'owner';

    const canRoles = hasPermission('configure_roles');
    const me = getSessionInfo()?.user_id;

    let userList = $state<string[]>([]), roles = $state<Record<string, AdminRole>>({}), err = $state<string | null>(null);
    let perms = $state<Record<string, AdminPermission>>({}), permOrder = $state<string[]>([]);
    let filter = $state('');
    const shownUsers = $derived(userList.filter(u => matchesQuery(filter, u)));
    const shownRoles = $derived(Object.entries(roles).filter(([id, r]) => matchesQuery(filter, id, r.name)));

    let view = $state<{ kind: 'user' | 'role'; id: string } | null>(null);
    let notice = $state<string | null>(null);

    async function load() {
        try {
            userList = (await api.adminListUsers()).users ?? [];
            if (canRoles) {
                if (!permOrder.length) { const p = await api.adminListPermissions(); perms = p.permissions ?? {}; permOrder = p.ordered ?? []; }
                roles = (await api.adminListRoles()).roles ?? {};
            }
            err = null;
        }
        catch (e) { err = e instanceof Error ? e.message : String(e); }
    }
    load();


    let info = $state<any>(null), oauth = $state('');
    async function openUser(name: string) {
        view = { kind: 'user', id: name };
        notice = null;
        info = null;
        try {
            const d = await api.adminGetUserInfo(name);
            if (view?.kind === 'user' && view.id === name) { info = d; oauth = d.oauth_email ?? ''; }
        }
        catch (e) { ui.error(e); }
    }
    async function deleteUser(name: string) {
        if (!(await ui.ask(`Delete user "${name}"?`, 'This action cannot be undone. Most user data will be lost. Image outputs will remain on drive. Changes outside of user personal data will remain.', { confirmLabel: 'Delete' }))) return;
        try { await api.adminDeleteUser(name); view = null; notice = `User "${name}" deleted.`; load(); }
        catch (e) { ui.error(e); }
    }
    async function impersonate(name: string) {
        if (!(await ui.ask(`Impersonate "${name}"?`, 'The page reloads signed in as this user. Use Stop impersonating in the banner to go back.', { confirmLabel: 'Impersonate', danger: false }))) return;
        const url = new URL(location.href);
        url.searchParams.set('impersonate', name);
        url.hash = '';
        location.href = url.toString();
    }
    async function applyOAuth(name: string) {
        try { await api.adminSetUserOAuthEmail(name, oauth.trim()); ui.toast('OAuth email updated.', 'success'); openUser(name); }
        catch (e) { ui.error(e); }
    }

    let pwOpen = $state(false), pw1 = $state(''), pw2 = $state(''), pwBusy = $state(false);
    const pwProblem = $derived(pw1 !== pw2 ? 'New passwords do not match' : pw1.length < 8 ? 'New password must be at least 8 characters long' : null);
    async function submitPassword() {
        if (view?.kind !== 'user' || pwProblem) return;
        const name = view.id;
        pwBusy = true;
        try { await api.adminSetUserPassword(name, await prehashPassword(name, pw1)); ui.toast(`Password changed for ${name}.`, 'success'); pwOpen = false; openUser(name); }
        catch (e) { ui.error(e); }
        pwBusy = false;
    }
    function showPassword() { pw1 = ''; pw2 = ''; pwOpen = true; }

    let addUserOpen = $state(false), nu = $state({ name: '', password: '', role: 'user' });
    const roleOptions = $derived(canRoles && Object.keys(roles).length
        ? Object.entries(roles).map(([id, r]) => ({ value: id, label: r.name ?? id, title: r.description }))
        : [{ value: 'user', label: 'User' }, { value: 'guest', label: 'Guest' }]);
    function showAddUser() { nu = { name: '', password: '', role: 'user' }; addUserOpen = true; }
    async function submitAddUser() {
        if (!nu.name.trim()) { ui.toast('Please fill in the name field, or cancel.', 'warning'); return; }
        if (!nu.password) { ui.toast('Please fill in the password field, or cancel.', 'warning'); return; }
        if (nu.password.length < 8) { ui.toast('New password must be at least 8 characters long.', 'warning'); return; }
        const name = nu.name.trim();
        try { await api.adminAddUser(name, await prehashPassword(name, nu.password), nu.role); addUserOpen = false; ui.toast(`User ${name} added.`, 'success'); load(); }
        catch (e) { ui.error(e); }
    }


    type Draft = { description: string; max_outpath_depth: number; max_t2i_simultaneous: number; max_queued: number; allow_unsafe_outpaths: boolean; model_whitelist: string; model_blacklist: string; permissions: string[] };
    const toDraft = (r: AdminRole): Draft => ({
        description: r.description ?? '', max_outpath_depth: r.max_outpath_depth, max_t2i_simultaneous: r.max_t2i_simultaneous, max_queued: r.max_queued,
        allow_unsafe_outpaths: !!r.allow_unsafe_outpaths, model_whitelist: (r.model_whitelist ?? []).join(', '), model_blacklist: (r.model_blacklist ?? []).join(', '), permissions: [...(r.permissions ?? [])],
    });
    let base = $state<Draft | null>(null), draft = $state<Draft | null>(null), roleBusy = $state(false);
    const role = $derived(view?.kind === 'role' ? roles[view.id] : null);
    const roleLocked = $derived(view?.kind === 'role' && view.id === OWNER_ROLE);
    const edits = $derived.by(() => {
        if (!base || !draft) return 0;
        let n = 0;
        for (const k of ['description', 'max_outpath_depth', 'max_t2i_simultaneous', 'max_queued', 'allow_unsafe_outpaths', 'model_whitelist', 'model_blacklist'] as const) if (`${draft[k]}` !== `${base[k]}`) n++;
        for (const p of permOrder) if (draft.permissions.includes(p) !== base.permissions.includes(p)) n++;
        return n;
    });
    const permGroups = $derived.by(() => {
        const out: { name: string; description: string; ids: string[] }[] = [];
        for (const id of permOrder) {
            const g = perms[id]?.group;
            if (!g) continue;
            if (out[out.length - 1]?.name !== g.name) out.push({ name: g.name, description: g.description, ids: [] });
            out[out.length - 1].ids.push(id);
        }
        return out;
    });
    async function openRole(id: string) {
        view = { kind: 'role', id };
        notice = null;
        try { roles = (await api.adminListRoles()).roles ?? {}; }
        catch (e) { ui.error(e); }
        const r = roles[id];
        if (!r) { view = null; notice = 'Role not found, something went wrong.'; return; }
        base = toDraft(r);
        draft = toDraft(r);
    }
    function setPerm(id: string, on: boolean) {
        if (!draft) return;
        draft.permissions = on ? [...draft.permissions, id] : draft.permissions.filter(p => p !== id);
    }
    async function saveRole() {
        if (view?.kind !== 'role' || !draft || roleLocked) return;
        const id = view.id;
        roleBusy = true;
        try {
            await api.adminEditRole({
                name: id, description: draft.description, max_outpath_depth: draft.max_outpath_depth, max_t2i_simultaneous: draft.max_t2i_simultaneous, max_queued: draft.max_queued,
                allow_unsafe_outpaths: draft.allow_unsafe_outpaths, model_whitelist: draft.model_whitelist, model_blacklist: draft.model_blacklist,
                permissions: permOrder.filter(p => draft!.permissions.includes(p)).join(','),
            });
            ui.toast(`Saved ${edits} edited setting${edits === 1 ? '' : 's'}.`, 'success');
            await openRole(id);
        }
        catch (e) { ui.error(e); }
        roleBusy = false;
    }
    async function deleteRole(id: string) {
        if (!(await ui.ask(`Delete role "${id}"?`, 'This action cannot be undone.', { confirmLabel: 'Delete' }))) return;
        try { await api.adminDeleteRole(id); view = null; notice = `Role "${id}" deleted.`; load(); }
        catch (e) { ui.error(e); }
    }

    let addRoleOpen = $state(false), newRole = $state('');
    function showAddRole() { newRole = ''; addRoleOpen = true; }
    async function submitAddRole() {
        if (!newRole.trim()) { ui.toast('Please fill in the name field, or cancel.', 'warning'); return; }
        try { await api.adminAddRole(newRole.trim()); addRoleOpen = false; ui.toast(`Role ${newRole.trim()} added.`, 'success'); load(); }
        catch (e) { ui.error(e); }
    }
</script>

{#if err}<EmptyState icon={LTriangleAlert} title="Couldn't load users" message={err} />{/if}
<div class="users">
    <div class="ulist">
        <SettingsSearch bind:value={filter} count={shownUsers.length + shownRoles.length} placeholder="Filter users and roles…" label="Filter users and roles" />
        {#if canRoles}
            <Section dense icon={LShield} title="Roles">
                {#snippet actions()}<Button size="sm" icon={LShieldPlus} onclick={showAddRole}>Add role</Button>{/snippet}
                {#each shownRoles as [id, r] (id)}
                    <button class="urow" class:on={view?.kind === 'role' && view.id === id} title={r.description} onclick={() => openRole(id)}>
                        <span>{r.name ?? id}</span>{#if id === OWNER_ROLE}<LLock size={12} aria-label="Read-only" />{/if}
                    </button>
                {:else}<p class="aha-muted">No roles match.</p>{/each}
            </Section>
        {/if}
        <Section dense icon={LUsers} title="Users">
            {#snippet actions()}<Button size="sm" icon={LUserPlus} onclick={showAddUser}>Add user</Button>{/snippet}
            {#each shownUsers as u (u)}
                <button class="urow" class:on={view?.kind === 'user' && view.id === u} title="Manage user '{u}'" onclick={() => openUser(u)}>
                    <span>{u}</span>{#if u === me}<Badge label="you" />{:else if u === LOCAL_USER}<LLock size={12} aria-label="Read-only" />{/if}
                </button>
            {:else}<p class="aha-muted">No users match.</p>{/each}
        </Section>
    </div>

    <div class="udetail">
        {#if view?.kind === 'user'}
            {@const name = view.id}
            <Section icon={LUser} plain title="User: {name}">
                {#if name === LOCAL_USER}
                    <p class="note"><LLock size={14} aria-hidden="true" />This is SwarmUI's built-in local user, used for accountless and local access. It can't be edited or deleted here, since changing it can lock you out of the server.</p>
                    {#if info}<KeyValueList dense label="User info" items={[{ key: 'Password was set by', value: info.password_set_by_admin ? 'Admin' : 'User' }]} />{/if}
                {:else}
                    {#if name === me}
                        <p class="note"><LInfo size={14} aria-hidden="true" />This is you! You shouldn't admin-edit yourself.</p>
                    {:else}
                        <div class="aha-acts ui-dense">
                            <Button variant="danger" icon={LUserX} onclick={() => deleteUser(name)}>Delete user</Button>
                            <Button icon={LVenetian} onclick={() => impersonate(name)}>Impersonate user</Button>
                        </div>
                    {/if}
                    {#if info}
                        <div class="aha-form ui-dense">
                            <FormRow label="Password" info="Force-set this user's password. Shows who last set it.">
                                <div class="inline"><Button icon={LKey} onclick={showPassword}>Change user password</Button><span class="aha-muted">Set by: <b>{info.password_set_by_admin ? 'Admin' : 'User'}</b></span></div>
                            </FormRow>
                            <FormRow label="OAuth email" info="The OAuth email linked to this user. Leave empty to clear it.">
                                <div class="inline field"><TextInput aria-label="OAuth email" type="email" bind:value={oauth} /><Button icon={LMail} disabled={oauth === (info.oauth_email ?? '')} onclick={() => applyOAuth(name)}>Apply</Button></div>
                            </FormRow>
                        </div>
                    {:else}<Skeleton lines={2} label="Loading user" />{/if}
                {/if}
            </Section>
            {#if name !== LOCAL_USER && info}
                {#key name}<SettingsTree label="Settings for {name}" load={async () => info.settings} save={async a => { await api.adminChangeUserSettings(name, a); await openUser(name); }} />{/key}
            {/if}
        {:else if view?.kind === 'role' && role && draft}
            {@const id = view.id}
            <Section icon={LShield} plain title="Role: {role.name ?? id}">
                {#if roleLocked}
                    <p class="note"><LLock size={14} aria-hidden="true" />The owner role has every permission and can't be edited here, so nobody can accidentally lock themselves out of the server.</p>
                {:else if role.is_auto_generated}
                    <p class="note"><LInfo size={14} aria-hidden="true" />This is an auto-generated role. It may not be deleted, and some automations may apply to it (such as new permissions automatically enabling when first loaded).</p>
                {:else}
                    <div class="aha-acts ui-dense"><Button variant="danger" icon={LShieldX} onclick={() => deleteRole(id)}>Delete role</Button></div>
                {/if}
                <fieldset class="aha-form ui-dense" disabled={roleLocked}>
                    <FormRow label="Description" info="Human-readable description text about this role. This is for admin reference when picking roles. Probably describe here when/why a user should receive this role, and a short bit about what it unlocks.">
                        <Textarea aria-label="Description" placeholder="Role description..." bind:value={draft.description} disabled={roleLocked} />
                    </FormRow>
                    <FormRow label="Max OutPath depth" info="How many directories deep a user's custom OutPath can be. Default is 5. This is just a minor protection to avoid filesystem corruption. Higher values are perfectly fine in most cases. The actual limit applied to a user is whatever the highest value of all their roles is.">
                        <NumberInput ariaLabel="Max OutPath depth" min={1} max={100} defaultValue={5} bind:value={draft.max_outpath_depth} disabled={roleLocked} />
                    </FormRow>
                    <FormRow label="Max T2I simultaneous" info="How many images this user can have actively generating at once. Default is 32. This is naturally sub-limited by the number of available backends. This is a protection for many-backend servers, to guarantee one user cannot steal all backends at once. The actual limit applied to a user is whatever the highest value of all their roles is.">
                        <NumberInput ariaLabel="Max T2I simultaneous" min={1} max={10000} defaultValue={32} bind:value={draft.max_t2i_simultaneous} disabled={roleLocked} />
                    </FormRow>
                    <FormRow label="Max queued" info="How many generations this user can have queued at once. Default is 100,000 (ie effectively infinite). Consider setting regular users low to prevent abuse and trusted users higher. The actual limit applied to a user is whatever the highest value of all their roles is.">
                        <NumberInput ariaLabel="Max queued" min={1} max={999999999} defaultValue={100000} bind:value={draft.max_queued} disabled={roleLocked} />
                    </FormRow>
                    <FormRow label="Allow unsafe OutPaths" info="Whether the '.' symbol can be used in OutPath - if enabled, users may cause file system issues or perform folder escapes.">
                        <Toggle hideLabel label="Allow unsafe OutPaths" bind:checked={draft.allow_unsafe_outpaths} disabled={roleLocked} />
                    </FormRow>
                    <FormRow label="Model whitelist" info="What models are allowed, as a list of prefixes. For example 'sdxl/' allows only models in the SDXL folder, or 'sdxl/,flux/' allows models in the SDXL or Flux folders. If empty, no whitelist logic is applied. Blacklist overrides whitelist. This stacks between roles.">
                        <TextInput aria-label="Model whitelist" placeholder="Model whitelist..." bind:value={draft.model_whitelist} disabled={roleLocked} />
                    </FormRow>
                    <FormRow label="Model blacklist" info="What models are forbidden, as a list of prefixes. For example 'sdxl/' forbids models in the SDXL folder, or 'sdxl/,flux/' forbids models in the SDXL or Flux folders. If empty, no blacklist logic is applied. Blacklist overrides whitelist. This stacks between roles.">
                        <TextInput aria-label="Model blacklist" placeholder="Model blacklist..." bind:value={draft.model_blacklist} disabled={roleLocked} />
                    </FormRow>
                </fieldset>
            </Section>
            <div class="perms aha-secs">
                {#each permGroups as g (g.name)}
                    <ParamGroup title={g.name} open>
                        {#if g.description}<p class="aha-muted">{g.description}</p>{/if}
                        {#each g.ids as p (p)}
                            <SwitchRow label={perms[p].name} info="{perms[p].description}\n\nID: {p}" checked={draft.permissions.includes(p) || (roleLocked && draft.permissions.includes('*'))} disabled={roleLocked} onchange={(on: boolean) => setPerm(p, on)} />
                        {/each}
                    </ParamGroup>
                {/each}
            </div>
            {#if edits && !roleLocked}
                <div class="confirm" role="status">
                    <span>Save {edits} edited setting{edits === 1 ? '' : 's'}?</span>
                    <span class="sp"></span>
                    <Button variant="danger" icon={LUndo} onclick={() => base && (draft = { ...base, permissions: [...base.permissions] })}>Discard</Button>
                    <Button variant="primary" icon={LSave} disabled={roleBusy} onclick={saveRole}>Save</Button>
                </div>
            {/if}
        {:else}
            <EmptyState icon={LInfo} title={notice ?? 'Welcome, admin!'} message="Select a user{canRoles ? ' or role' : ''} on the left to configure them." />
        {/if}
    </div>
</div>

<Modal bind:open={pwOpen} tone="panel" title="Change password for {view?.kind === 'user' ? view.id : ''}" size="sm">
    <div class="aha-form ui-dense">
        <FormRow label="New password"><TextInput aria-label="New password" type="password" autocomplete="new-password" bind:value={pw1} /></FormRow>
        <FormRow label="Confirm password"><TextInput aria-label="Confirm new password" type="password" autocomplete="new-password" bind:value={pw2} invalid={!!pw2 && pw1 !== pw2} /></FormRow>
        {#if pw1 && pwProblem}<p class="aha-muted">{pwProblem}</p>{/if}
    </div>
    {#snippet footer()}
        <Button onclick={() => (pwOpen = false)}>Cancel</Button>
        <Button variant="primary" icon={LKey} disabled={!!pwProblem || pwBusy} onclick={submitPassword}>Change password</Button>
    {/snippet}
</Modal>

<Modal bind:open={addUserOpen} tone="panel" title="Add user" size="sm">
    <div class="aha-form ui-dense">
        <FormRow label="Username" info="The name to give to the user. This will be used as a unique lookup ID, so keep it simple. No funky symbols, spaces, etc."><TextInput aria-label="New user's name" placeholder="New user's name..." autocomplete="off" bind:value={nu.name} /></FormRow>
        <FormRow label="Password" info="Initial password to give to the user. The user will be asked to change this immediately after logging in automatically."><TextInput aria-label="New user's password" type="password" autocomplete="new-password" placeholder="New user's password..." bind:value={nu.password} /></FormRow>
        <FormRow label="Role" info="Initial role to give to the user. This can be changed later."><Dropdown ariaLabel="Role" options={roleOptions} bind:value={nu.role} /></FormRow>
    </div>
    {#snippet footer()}
        <Button onclick={() => (addUserOpen = false)}>Cancel</Button>
        <Button variant="primary" icon={LUserPlus} onclick={submitAddUser}>Add user</Button>
    {/snippet}
</Modal>

<Modal bind:open={addRoleOpen} tone="panel" title="Add role" size="sm">
    <div class="aha-form ui-dense">
        <FormRow label="Role name" info="The name to give to the role. This will be used as a unique lookup ID, so keep it simple. No funky symbols, spaces, etc."><TextInput aria-label="New role's name" placeholder="New role's name..." autocomplete="off" bind:value={newRole} /></FormRow>
    </div>
    {#snippet footer()}
        <Button onclick={() => (addRoleOpen = false)}>Cancel</Button>
        <Button variant="primary" icon={LShieldPlus} onclick={submitAddRole}>Add role</Button>
    {/snippet}
</Modal>

<style>
    .users { display: flex; gap: var(--space-2); align-items: flex-start; }
    .ulist { flex: 0 0 260px; display: flex; flex-direction: column; gap: var(--space-1); position: sticky; top: 0; }
    .urow { display: flex; align-items: center; gap: var(--space-1); width: 100%; text-align: left; height: 28px; padding: 0 var(--space-2); border-radius: var(--radius-sm); color: var(--color-ink-2); }
    .urow > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .urow > :global(svg) { color: var(--color-ink-3); flex: none; }
    .urow:hover { background: var(--color-hover); color: var(--color-ink); }
    .urow.on { background: var(--color-active); color: var(--color-ink); }
    .udetail { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
    .note { display: flex; align-items: flex-start; gap: var(--space-1); margin: 0 0 var(--space-1); padding: var(--space-2); border-radius: var(--radius-ui); background: var(--param-panel-bg); color: var(--color-ink-2); font-size: var(--text-ui, 13px); }
    .note > :global(svg) { flex: none; margin-top: 2px; color: var(--color-ink-3); }
    .inline { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
    .inline.field { flex-wrap: nowrap; }
    .inline.field > :global(:first-child) { flex: 1; min-width: 0; }
    fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    .perms { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-1); align-items: start; }
    .confirm { position: sticky; bottom: 0; z-index: 3; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2); margin-top: var(--space-2);
        background: var(--color-raised); border-radius: var(--radius-ui); box-shadow: var(--shadow-up); }
    .sp { flex: 1; }
    @media (max-width: 640px) { .users { flex-direction: column; } .ulist { flex: none; width: 100%; position: static; } }
</style>
