<script lang="ts">
    import { tick } from 'svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { paramState } from '../../lib/state/params.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { getSessionInfo, swarmRoot } from '../../lib/api/client';
    import { Button, ColorSwatches, Grid, Icon, SegmentedControl, Dropdown, EmptyState, Field, InfoButton, KeyValueList, ParamGroup, SearchGroup, SearchItem, SearchScope, SettingsSearch, Tabs, Toggle, provideSearch, THEMES, setTheme, themeAccentOptions, themeLabel, type ContrastMode } from '../ui';
    import LSearchX from '@lucide/svelte/icons/search-x';
    import { api, hasPermission } from '../../lib/api/swarm';
    import { userSettings } from '../../lib/state/usersettings.svelte';
    import SettingsTree from './SettingsTree.svelte';
    import AboutVersions from './AboutVersions.svelte';

    import LCloud from '@lucide/svelte/icons/server';
    import LRotate from '@lucide/svelte/icons/rotate-ccw';
    import LRefresh from '@lucide/svelte/icons/refresh-cw';
    import LSettings from '@lucide/svelte/icons/settings-2';
    import LSliders from '@lucide/svelte/icons/sliders-horizontal';
    import LUser from '@lucide/svelte/icons/user';
    import LInfo from '@lucide/svelte/icons/info';
    import { subPages } from '../../lib/nav';
    import { pwa, install } from '../../lib/pwa.svelte';
    import LDownload from '@lucide/svelte/icons/download';
    import LExternalLink from '@lucide/svelte/icons/external-link';
    import LBug from '@lucide/svelte/icons/bug';
    const SOURCE_URL = 'https://github.com/AshtakaOOf/AhaSwarm-SwarmUI';
    const ISSUE_URL = `${SOURCE_URL}/issues/new`;
    const canServer = hasPermission('read_server_settings');
    const mode = $derived(ui.sub.settings === 'aha' ? 'aha' : 'swarm');
    const swarmTab = $derived(ui.sub.settings === 'server' && canServer ? 'server' : 'user');
    const tabs = $derived(subPages('settings'));

    const session = getSessionInfo();
    function save() { ui.saveSettings(); }
    const search = provideSearch(new SearchScope());
    const CONTRAST_OPTIONS = [{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }];
    const THEME_OPTIONS = THEMES.map(t => ({ value: t.id, label: themeLabel(t) }));
    const THEME_SEARCH = `Theme appearance colour scheme dark light ${THEME_OPTIONS.map(o => o.label).join(' ')}`;
    let accentOptions = $state(themeAccentOptions());
    $effect(() => {
        const id = ui.settings.theme;
        setTheme(id).then(tick).then(() => { if (ui.settings.theme === id) accentOptions = themeAccentOptions(); }, () => {});
    });
    function setAccentChoice(v: string) {
        if (v && !accentOptions.some(o => o.value.toLowerCase() === v.toLowerCase())) ui.settings.lastCustomAccent = v;
        ui.settings.accents = { ...ui.settings.accents, [ui.settings.theme]: v };
        save();
    }
</script>

<div class="aha-page">
    <Tabs {tabs} value={mode === 'aha' ? 'aha' : swarmTab} onchange={(id: string) => ui.setSub('settings', id)} label="Settings sections" />
    <div class="aha-body aha-secs">
    {#if mode === 'swarm'}
        <div class="swarm">
            {#if swarmTab === 'server' && canServer}
                {#key 'server'}<SettingsTree label="Server settings" load={async () => (await api.listServerSettings()).settings} save={hasPermission('edit_server_settings') ? (a: Record<string, any>) => api.changeServerSettings(a) : undefined} />{/key}
            {:else}
                {#key 'user'}<SettingsTree label="User settings" load={async () => (await api.getUserSettings()).settings} save={hasPermission('edit_user_settings') ? async (a: Record<string, any>) => { await api.changeUserSettings(a); await userSettings.load().catch(() => {}); } : undefined} />{/key}
            {/if}
        </div>
    {:else}
    <SettingsSearch scope={search} label="Search AhaSwarm settings" />
    {#if search.active && !search.count}<EmptyState icon={LSearchX} title="No matching settings" message="Nothing in AhaSwarm settings matches “{search.query.trim()}”." />{/if}
    <Grid cols={3} min="340px" balance label="AhaSwarm settings">
    <SearchGroup title="Interface">{#snippet children(searching)}
    <ParamGroup title="Interface" icon={LSettings} open={true}>
        <div class="form">
            <SearchItem text="Ctrl+Enter in the prompt generates keyboard shortcut"><Toggle label="Ctrl+Enter in the prompt generates" bind:checked={ui.settings.ctrlEnterGenerates} onchange={save} /></SearchItem>
            <SearchItem text={THEME_SEARCH}><div class="w"><Dropdown label="Theme" options={THEME_OPTIONS} bind:value={ui.settings.theme} onchange={save} /></div></SearchItem>
            <SearchItem text="Accent colour color primary highlight swatch custom"><Field label="Accent colour"><ColorSwatches label="Accent colour" options={accentOptions} recent={ui.settings.lastCustomAccent} value={ui.settings.accents[ui.settings.theme] ?? ''} onchange={setAccentChoice} /></Field></SearchItem>
            <SearchItem text="Hide Classic UI button navbar top bar link"><Toggle label="Hide the Classic UI button" bind:checked={ui.settings.hideClassicButton} onchange={save} /></SearchItem>
            <SearchItem text="Hide title in the navbar brand name AhaSwarm top bar"><Toggle label="Hide the title in the navbar" bind:checked={ui.settings.hideTitle} onchange={save} /></SearchItem>
            <SearchItem text="Hide folder depth History Models browser levels"><span class="depth-toggle"><Toggle label="Hide folder depth" bind:checked={ui.settings.hideFolderDepth} onchange={save} /><InfoButton label="Hide folder depth" text="How many folder levels deep the browser lists items from the selected folder. When this is on, the depth control is hidden and the maximum depth is used." /></span></SearchItem>
            <SearchItem text="High contrast borders accessibility theme auto system forced colors"><Field label="High contrast"><SegmentedControl label="High contrast" value={ui.settings.contrast} onchange={(v: string) => { ui.settings.contrast = v as ContrastMode; save(); }} options={CONTRAST_OPTIONS} /></Field></SearchItem>
            <SearchItem text="Browser card and thumbnail images fit fill contain cover"><div class="w"><Dropdown label="Browser card and thumbnail images" options={[{ value: 'contain', label: 'Fit (contain)' }, { value: 'cover', label: 'Fill (cover)' }]} bind:value={ui.settings.browserFit} onchange={save} /></div></SearchItem>
            <SearchItem text="Current image fit fill contain cover"><div class="w"><Dropdown label="Current image fit" options={[{ value: 'contain', label: 'Fit (contain)' }, { value: 'cover', label: 'Fill (cover)' }]} bind:value={ui.settings.imageFit} onchange={save} /></div></SearchItem>
            <SearchItem text="Current image buttons actions position overlay above metadata"><div class="w"><Dropdown label="Current image buttons" options={[{ value: 'overlay', label: 'On the image' }, { value: 'above-metadata', label: 'Above the metadata' }]} bind:value={ui.settings.imageActions} onchange={save} /></div></SearchItem>
            <SearchItem text="Models without a preview image placeholder icon swarm"><div class="w"><Dropdown label="Models without a preview image" options={[{ value: 'icon', label: 'Icon' }, { value: 'swarm', label: 'Swarm image' }]} bind:value={ui.settings.modelPlaceholder} onchange={save} /></div></SearchItem>
        </div>
    </ParamGroup>
    {/snippet}</SearchGroup>
    <SearchGroup title="Parameters">{#snippet children(searching)}
    <ParamGroup title="Parameters" icon={LSliders} open={searching}>
        <div class="aha-acts ui-dense">
            <SearchItem text="Reset all parameters defaults"><Button variant="danger" icon={LRotate} onclick={async () => { if (await ui.ask('Reset all parameters?', 'Every parameter goes back to its default value.', { confirmLabel: 'Reset' })) { presetState.resetParams(); } }}>Reset all parameters</Button></SearchItem>
            <SearchItem text="Reload parameter list from server refresh"><Button icon={LRefresh} onclick={async () => { await paramState.load(); }}>Reload parameter list from server</Button></SearchItem>
        </div>
    </ParamGroup>
    {/snippet}</SearchGroup>
    <SearchGroup title="Account">{#snippet children(searching)}
    <ParamGroup title="Account" icon={LUser} open={searching}>
        <div class="form">
            <SearchItem text="Signed in as user account {session?.user_id ?? ''}"><KeyValueList dense label="Account" items={[{ key: 'Signed in as', value: session?.user_id ?? '?' }]} /></SearchItem>
            <SearchItem text="Open Swarm settings user server"><div class="aha-acts ui-dense"><Button icon={LCloud} onclick={() => ui.setSub('settings', 'user')}>Open Swarm settings</Button></div></SearchItem>
        </div>
    </ParamGroup>
    {/snippet}</SearchGroup>
    <SearchGroup title="About">{#snippet children(searching)}
    <ParamGroup title="About" icon={LInfo} open={true}>
        <SearchItem text="AhaSwarm about frontend SwarmUI">
            <div class="about">
                <img class="logo" src="./icon.svg" alt="" width="36" height="36" />
                <div class="brand">
                    <span class="name">AhaSwarm</span>
                    <span class="sub">A cleaner, smoother frontend for SwarmUI.</span>
                </div>
            </div>
        </SearchItem>
        <div class="form">
            <SearchItem text="AhaSwarm SwarmUI version commit">
                <AboutVersions swarmVersion={session?.version ?? '?'} />
            </SearchItem>
            {#if !pwa.installed && pwa.prompt}
                <SearchItem text="Install app PWA home screen desktop mobile">
                    <div class="aha-acts ui-dense"><Button icon={LDownload} onclick={install}>Install AhaSwarm as a PWA</Button></div>
                </SearchItem>
            {:else if !pwa.installed}
                <SearchItem text="Install app PWA browser menu home screen">
                    <p class="hint">Add AhaSwarm to your home screen from your browser's menu.</p>
                </SearchItem>
            {/if}
            <SearchItem text="Source code report bug issue GitHub SwarmUI links">
                <div class="aha-acts ui-dense">
                    <a class="ctl" href={SOURCE_URL} target="_blank" rel="noopener noreferrer"><Icon icon={LExternalLink} />Source</a>
                    <a class="ctl" href={ISSUE_URL} target="_blank" rel="noopener noreferrer"><Icon icon={LBug} />Report an issue</a>
                </div>
            </SearchItem>
        </div>
    </ParamGroup>
    {/snippet}</SearchGroup>
    </Grid>
    {/if}
    </div>
</div>

<style>
    .form { display: flex; flex-direction: column; gap: var(--space-2); }
    .w { max-width: 360px; }
    .about { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
    .depth-toggle { display: inline-flex; align-items: center; gap: var(--space-1); }
    .logo { flex: none; width: 36px; height: 36px; }
    .brand { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .name { font-size: var(--text-body); font-weight: 600; color: var(--color-ink); }
    .sub { font-size: var(--text-small); color: var(--color-ink-3); }
    .hint { margin: 0; font-size: var(--text-small); color: var(--color-ink-3); }
</style>
