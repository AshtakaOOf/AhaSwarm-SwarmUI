<script lang="ts">
    import { untrack } from 'svelte';
    import LMenu from '@lucide/svelte/icons/menu';
    import LChevronLeft from '@lucide/svelte/icons/chevron-left';
    import LExternalLink from '@lucide/svelte/icons/external-link';
    import { ui, type Page } from '../../lib/state/ui.svelte';
    import { gen } from '../../lib/state/gen.svelte';
    import { swarmRoot, onSession } from '../../lib/api/client';
    import UserMenu from './UserMenu.svelte';
    import { subPages } from '../../lib/nav';
    import { Tabs, Button, IconButton, Popover, ProgressBar, StatusDot, Menu, type Status, type MenuItem } from '../ui';
    import QueueList from '../generate/QueueList.svelte';

    const tabs = [
        { id: 'generate', label: 'Generate' },
        { id: 'simple', label: 'Simple' },
        { id: 'utilities', label: 'Utilities' },
        { id: 'server', label: 'Server' },
        { id: 'settings', label: 'Settings' },
    ];
    let sessionTick = $state(0);
    onSession(() => sessionTick++);
    const menus = $derived.by(() => {
        sessionTick;
        return Object.fromEntries((['utilities', 'server', 'settings'] as const).map(pg => [pg, subPages(pg).map(sp => ({ id: sp.id, label: sp.label, icon: sp.icon, onselect: () => { ui.setSub(pg, sp.id); ui.go(pg); } }))]));
    });
    const navItems = $derived.by((): MenuItem[] => {
        sessionTick;
        const out: MenuItem[] = [];
        for (const t of tabs) {
            const id = t.id as Page;
            if (id === 'utilities' || id === 'server' || id === 'settings') {
                out.push({ id: `${id}-h`, label: t.label, header: true });
                for (const sp of subPages(id)) {
                    out.push({
                        id: `${id}-${sp.id}`,
                        label: sp.label,
                        icon: sp.icon,
                        checked: ui.page === id && ui.sub[id] === sp.id,
                        onselect: () => { ui.setSub(id, sp.id); ui.go(id); },
                    });
                }
            }
            else {
                out.push({ id, label: t.label, checked: ui.page === id, onselect: () => ui.go(id) });
            }
        }
        return out;
    });
    let queueOpen = $state(false);
    let navOpen = $state(false);
    let accountOpen = $state(false);
    const canGoBack = $derived(navOpen || queueOpen || accountOpen || ui.paramsOpen || ui.batchOpen || ui.bottomOpen);
    function goBack() {
        if (navOpen) {
            navOpen = false;
            return;
        }
        if (queueOpen) {
            queueOpen = false;
            return;
        }
        if (accountOpen) {
            accountOpen = false;
            return;
        }
        if (ui.paramsOpen) {
            ui.paramsOpen = false;
            return;
        }
        if (ui.batchOpen) {
            ui.batchOpen = false;
            return;
        }
        if (ui.bottomOpen) {
            ui.bottomOpen = false;
        }
    }
    const showBrand = $derived(!ui.settings.hideTitle);
    const showClassic = $derived(!ui.settings.hideClassicButton && (!ui.mobile || ui.page === 'settings'));
    const bs = $derived(gen.status?.backend_status);
    const statusText = $derived(gen.statusError ? `Disconnected: ${gen.statusError}` : bs ? (bs.message || bs.status) : 'Connecting…');
    const dot = $derived.by((): Status => {
        if (gen.statusError) {
            return 'offline';
        }
        if (!bs) {
            return 'idle';
        }
        if (gen.running.length) {
            return 'running';
        }
        switch (bs.status) {
            case 'running': return 'success';
            case 'loading': return 'queued';
            case 'error': return 'error';
            default: return 'warning';
        }
    });
    const shortText = $derived(gen.statusError ? 'Disconnected' : !bs ? 'Connecting…' : dot === 'warning' ? 'Backend warning' : dot === 'error' ? 'Backend error' : statusText);
    $effect(() => {
        const t = statusText;
        const d = dot;
        if (d === 'warning' || d === 'error' || d === 'offline') {
            untrack(() => ui.toast(t, d === 'warning' ? 'warning' : 'error'));
        }
    });
    $effect(() => {
        if (!ui.mobile) {
            navOpen = false;
            queueOpen = false;
            accountOpen = false;
        }
    });
    $effect(() => {
        ui.page;
        navOpen = false;
        queueOpen = false;
        accountOpen = false;
    });

</script>

{#snippet queueLabel()}
    <StatusDot status={dot} label={gen.running.length ? 'Generating' : shortText} /><span class="st" class:bad={dot === 'error' || dot === 'offline'}>Queue</span>{#if gen.running.length > 1}<span class="n">{gen.running.length}</span>{/if}
{/snippet}

{#snippet queueBody()}
    <div class="qstate" title={statusText}><StatusDot status={dot === 'running' ? 'success' : dot} label="Backend status" /><span class="qt">Backend status: {shortText}</span></div>
    <div class="queue-pop"><QueueList empty="Nothing is generating." /></div>
{/snippet}

<header class="top">
    {#if ui.mobile}
        <IconButton class="back" icon={LChevronLeft} label="Back" disabled={!canGoBack} onclick={goBack} />
        <Menu bind:open={navOpen} items={navItems} label="Pages" dense>
            {#snippet trigger(p)}<IconButton {...p} icon={LMenu} label="Pages" pressed={navOpen} />{/snippet}
        </Menu>
    {/if}
    {#if showBrand}<strong class="brand inline-flex h-8 shrink-0 items-center font-semibold tracking-tight">Aha<span class="font-normal text-ink-3">Swarm</span></strong>{/if}
    {#if !ui.mobile}
        <nav class="nav" aria-label="Pages"><Tabs {tabs} {menus} value={ui.page} onchange={(id: string) => ui.go(id as Page)} label="Pages" /></nav>
    {:else}
        <span class="grow"></span>
    {/if}
    <span class="status" role="status">
        <Popover bind:open={queueOpen} label="Backend status and generation queue" compact flush wide placement="bottom" pin={ui.mobile ? 'top' : undefined} pinHeight={ui.mobile ? '65dvh' : undefined}>
            {#snippet trigger(p)}<Button {...p} variant="ghost" title={statusText} aria-label="Queue: {gen.running.length ? `${gen.running.length} generating` : shortText}">{@render queueLabel()}</Button>{/snippet}
            {@render queueBody()}
        </Popover>
    </span>
    <span class="user"><UserMenu bind:open={accountOpen} /></span>
    {#if showClassic}
    <span class="classic-wide"><Button variant="ghost" icon={LExternalLink} onclick={() => (location.href = `${swarmRoot}Text2Image`)}>Classic UI</Button></span>
    <span class="classic-narrow"><IconButton icon={LExternalLink} label="Classic UI" onclick={() => (location.href = `${swarmRoot}Text2Image`)} /></span>
    {/if}
    {#if gen.progress}<div class="bar"><ProgressBar value={gen.progress.overall} hideLabel ariaLabel="Generating" /></div>{/if}
</header>

<style>
    .top { position: relative; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-1) calc(var(--space-5) - 10px) var(--space-1) var(--space-5); background: var(--color-panel); }
    .top > * { flex: none; }
    .top > .nav { flex: 1; }
    .status, .user, .classic-wide, .classic-narrow { display: flex; align-items: center; height: var(--size-control); }
    .brand { white-space: nowrap; }
    .nav { flex: 1; min-width: 0; overflow-x: auto; }
    .status { max-width: 360px; min-width: 0; }
    .st { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-ink-2); }
    .st.bad { color: var(--color-danger-text); }
    .n { font-variant-numeric: tabular-nums; color: var(--color-ink-3); }
    .qstate { display: flex; align-items: center; gap: var(--space-1); padding: var(--space-2) 10px; font-size: var(--text-small, 12px); font-weight: 600; color: var(--color-ink); border-bottom: 1px solid var(--color-border-strong); }
    .qt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .queue-pop { width: 480px; max-width: calc(100vw - 24px); max-height: 60vh; overflow-y: auto; }
    .bar { position: absolute; left: 0; right: 0; bottom: 0; }
    .classic-narrow { display: none; }
    .grow { flex: 1; min-width: 0; }
    .top > .status { flex: 0 1 auto; }
    @media (max-width: 768px) {
        .top { padding: var(--space-1) var(--space-2); padding-top: max(var(--space-1), env(safe-area-inset-top)); gap: var(--space-1); }
        .classic-wide { display: none; }
        .classic-narrow { display: flex; }
        .status { max-width: none; }
        .queue-pop { width: auto; max-width: none; max-height: none; }
        .brand { margin-left: var(--space-3); }
        .top :global(.back:disabled),
        .top :global(.back[aria-disabled='true']) { background: transparent; color: var(--color-ink-2); opacity: 1; }
        .top :global(.back:disabled > *),
        .top :global(.back[aria-disabled='true'] > *) { opacity: 1; color: var(--color-ink-3); }
    }
</style>
