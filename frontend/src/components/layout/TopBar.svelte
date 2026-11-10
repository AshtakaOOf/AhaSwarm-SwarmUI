<script lang="ts">
    import { untrack } from 'svelte';
    import LMenu from '@lucide/svelte/icons/menu';
    import LExternalLink from '@lucide/svelte/icons/external-link';
    import { ui, type Page } from '../../lib/state/ui.svelte';
    import { gen } from '../../lib/state/gen.svelte';
    import { swarmRoot, onSession } from '../../lib/api/client';
    import UserMenu from './UserMenu.svelte';
    import { subPages } from '../../lib/nav';
    import { Tabs, Button, IconButton, Popover, ProgressBar, StatusDot, type Status } from '../ui';
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
    let queueOpen = $state(false);
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
</script>

<header class="top">
    {#if ui.page === 'generate'}
        <div class="drawer"><IconButton icon={LMenu} label="Parameters" pressed={ui.paramsOpen} onclick={() => (ui.paramsOpen = !ui.paramsOpen)} /></div>
    {/if}
    <strong class="brand inline-flex h-8 shrink-0 items-center font-semibold tracking-tight">Aha<span class="font-normal text-ink-3">Swarm</span></strong>
    <nav class="nav" aria-label="Pages"><Tabs {tabs} {menus} value={ui.page} onchange={(id: string) => ui.go(id as Page)} label="Pages" /></nav>
    <span class="status" role="status">
        <Popover bind:open={queueOpen} label="Backend status and generation queue" compact flush placement="bottom">
            {#snippet trigger(p)}<Button {...p} variant="ghost" title={statusText} aria-label="Queue: {gen.running.length ? `${gen.running.length} generating` : shortText}"><StatusDot status={dot} label={gen.running.length ? 'Generating' : shortText} /><span class="st" class:bad={dot === 'error' || dot === 'offline'}>Queue</span>{#if gen.running.length > 1}<span class="n">{gen.running.length}</span>{/if}</Button>{/snippet}
            <div class="qstate" title={statusText}><StatusDot status={dot === 'running' ? 'success' : dot} label="Backend status" /><span class="qt">Backend status: {shortText}</span></div>
            <div class="queue-pop"><QueueList empty="Nothing is generating." /></div>
        </Popover>
    </span>
    <span class="user"><UserMenu /></span>
    {#if !ui.settings.hideClassicButton}
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
    .queue-pop { width: 320px; max-width: calc(100vw - 24px); max-height: 60vh; overflow-y: auto; }
    .bar { position: absolute; left: 0; right: 0; bottom: 0; }
    .drawer { display: none; }
    .classic-narrow { display: none; }
    .top > .status { flex: 0 1 auto; }
    @media (max-width: 760px) { .top { padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3); gap: var(--space-2); } .drawer { display: block; } .status { display: none; } .classic-wide { display: none; } .classic-narrow { display: flex; } }
</style>
