<script lang="ts">
    import LUser from '@lucide/svelte/icons/user';
    import LLogOut from '@lucide/svelte/icons/log-out';
    import LKey from '@lucide/svelte/icons/key-round';
    import { api } from '../../lib/api/swarm';
    import { getSessionInfo, swarmRoot } from '../../lib/api/client';
    import { classicDoc } from '../../lib/api/classicPage';
    import { ui } from '../../lib/state/ui.svelte';
    import LSave from '@lucide/svelte/icons/save';
    import LTrash from '@lucide/svelte/icons/trash-2';
    import { Button, IconButton, Popover, TextInput, Tooltip, safeUrl } from '../ui';

    let open = $state(false);
    const session = $derived(getSessionInfo());
    const user = $derived(session?.user_id ?? '');
    const loggedIn = $derived(!!user && user !== 'local');
    let keys = $state<{ type: string; title: string; link: string; status: string; input: string; busy: boolean }[]>([
        { type: 'civitai_api', title: 'Civitai', link: 'https://civitai.com/user/account', status: '…', input: '', busy: false },
        { type: 'huggingface_api', title: 'Hugging Face', link: 'https://huggingface.co/settings/tokens', status: '…', input: '', busy: false },
    ]);
    let loaded = false;
    async function load() {
        if (!loaded) {
            loaded = true;
            try {
                const rows = [...(await classicDoc()).querySelectorAll('#api_keys_table tr[data-key]')];
                for (const r of rows) {
                    const type = r.getAttribute('data-key') ?? '';
                    if (type && !keys.some(k => k.type === type)) keys.push({ type, title: r.querySelector('b')?.textContent?.trim() || type, link: r.querySelector('a')?.getAttribute('href') ?? '', status: '…', input: '', busy: false });
                }
            } catch {}
        }
        for (const k of keys) api.getAPIKeyStatus(k.type).then(r => (k.status = r.status), () => (k.status = 'unknown'));
    }
    $effect(() => { if (open) load(); });
    const isSet = (s: string) => s.startsWith('last updated');

    async function saveKey(k: (typeof keys)[number]) {
        const v = k.input.trim();
        if (!v) return;
        k.busy = true;
        try { await api.setAPIKey(k.type, v); k.input = ''; ui.toast(`${k.title} key saved.`, 'success'); k.status = (await api.getAPIKeyStatus(k.type)).status; }
        catch (e) { ui.error(e); }
        k.busy = false;
    }
    async function clearKey(k: (typeof keys)[number]) {
        open = false;
        if (!(await ui.ask(`Remove the ${k.title} API key?`, `Features that use ${k.title} (model downloads, metadata lookups) stop working until you add a key again.`, { confirmLabel: 'Remove' }))) return;
        try { await api.setAPIKey(k.type, 'none'); ui.toast(`${k.title} key removed.`, 'success'); k.status = (await api.getAPIKeyStatus(k.type)).status; }
        catch (e) { ui.error(e); }
    }
    async function logout() {
        open = false;
        if (!(await ui.ask('Sign out?', 'This will close all current sessions originating from this browser.', { confirmLabel: 'Sign out' }))) return;
        try { await api.logout(); } catch {}
        location.href = `${swarmRoot}Login`;
    }
</script>

<Popover bind:open title={loggedIn ? `Signed in as ${user}` : 'Credentials'} label={loggedIn ? 'Account' : 'Credentials'}>
    {#snippet trigger(p)}<Button {...p} variant="ghost" icon={loggedIn ? LUser : LKey} class="user-btn"><span class="uname">{loggedIn ? user : 'Credentials'}</span></Button>{/snippet}
    <div class="menu ui-dense">
        {#if loggedIn}
            <Button variant="danger" icon={LLogOut} onclick={logout}>Sign out</Button>
            <h4><LKey size={12} aria-hidden="true" /> API keys</h4>
        {/if}
        <p class="muted">Keys for remote services. Saved keys are never shown again; replace or remove them here.</p>
        {#each keys as k (k.type)}
            <div class="key">
                <div class="khead">
                    <span class="kname">{#if safeUrl(k.link)}<a href={safeUrl(k.link)} target="_blank" rel="noreferrer noopener">{k.title}</a>{:else}{k.title}{/if}</span>
                    <span class="kstat" class:set={isSet(k.status)}>{isSet(k.status) ? `Set - ${k.status.replace('last updated ', '')}` : k.status === 'not set' ? 'Not set' : k.status}</span>
                </div>
                <div class="krow">
                    <TextInput type="password" autocomplete="off" aria-label="{k.title} API key" placeholder={isSet(k.status) ? 'Replace key…' : `${k.title} API key`} bind:value={k.input}
                        onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') saveKey(k); }} />
                    <Tooltip text="Save {k.title} key"><IconButton title="" variant="primary" icon={LSave} label="Save {k.title} key" disabled={!k.input.trim() || k.busy} onclick={() => saveKey(k)} /></Tooltip>
                    <Tooltip text={isSet(k.status) ? `Remove ${k.title} key` : 'No key to remove'}><IconButton title="" variant="danger" icon={LTrash} label="Remove {k.title} key" disabled={!isSet(k.status)} onclick={() => clearKey(k)} /></Tooltip>
                </div>
            </div>
        {/each}
    </div>
</Popover>

<style>
    .menu { display: flex; flex-direction: column; gap: var(--space-1); width: 300px; max-width: 100%; }
    .menu > :global(.ctl) { align-self: flex-start; }
    h4 { margin: var(--space-2) 0 0; display: flex; align-items: center; gap: 4px; font-size: var(--text-small, 12px); font-weight: 400; color: var(--color-ink-3); text-transform: uppercase; }
    .muted { margin: 0; font-size: var(--text-small, 12px); color: var(--color-ink-3); line-height: 16px; }
    .key { display: flex; flex-direction: column; gap: 2px; padding: var(--space-1) 0; }
    .khead { display: flex; align-items: baseline; gap: var(--space-2); }
    .kname { font-weight: 600; }
    .kname a { color: var(--color-ink); }
    .kname a:hover { text-decoration: underline; }
    .kstat { margin-left: auto; font-size: var(--text-small, 12px); color: var(--color-ink-3); }
    .kstat.set { color: var(--color-ink-2); }
    .krow { display: flex; gap: var(--space-1); }
    .krow > :global(:first-child) { flex: 1; min-width: 0; }
    .uname { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 720px) { .uname { display: none; } }
</style>
