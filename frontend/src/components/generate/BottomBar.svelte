<script lang="ts">
    import { hasPermission } from '../../lib/api/swarm';
    import { ui, type BottomTab } from '../../lib/state/ui.svelte';
    import { swipe, type SwipeInfo } from '../../lib/util/swipe';
    import { toolState } from '../../lib/state/tools.svelte';
    import { cleanModelName, paramState } from '../../lib/state/params.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { selectModel } from '../../lib/state/models';
    import LMenu from '@lucide/svelte/icons/menu';
    import { Tabs, Dropdown, Chip, Menu, IconButton, type MenuItem } from '../ui';
    import LoraBar from './LoraBar.svelte';
    import GenerateControls from './GenerateControls.svelte';
    import HistoryPage from '../history/HistoryPage.svelte';
    import ToolsPanel from './ToolsPanel.svelte';
    import { untrack } from 'svelte';
    import { lazy } from '../../lib/util/lazy';

    const loadPresets = lazy(() => import('../presets/PresetsPage.svelte'));
    const loadModels = lazy(() => import('../models/ModelsPage.svelte'));

    // hide Wildcards when the server has none and this user cannot create one
    const showWildcards = $derived((paramState.wildcards?.length ?? 0) > 0 || hasPermission('edit_wildcards'));
    const showTools = $derived(toolState.available().length > 0);
    const tabs = $derived<{ id: BottomTab; label: string }[]>([
        { id: 'history', label: 'History' },
        { id: 'presets', label: 'Presets' },
        { id: 'Stable-Diffusion', label: 'Models' },
        { id: 'VAE', label: 'VAEs' },
        { id: 'LoRA', label: 'LoRAs' },
        { id: 'Embedding', label: 'Embeddings' },
        { id: 'ControlNet', label: 'ControlNets' },
        ...(showWildcards ? [{ id: 'Wildcards' as const, label: 'Wildcards' }] : []),
        ...(showTools ? [{ id: 'tools' as const, label: 'Tools' }] : []),
    ]);
    $effect(() => {
        if (ui.bottomTab === 'Wildcards' && !showWildcards) {
            ui.showBottom('history');
        }
        if (ui.bottomTab === 'tools' && !showTools) {
            ui.showBottom('history');
        }
    });
    // bottom region order: model bar (Model / presets / LoRAs / Generate) → tab row → content
    let { onopen, onclose, ondrag, ondragend, open = false, stripEl = $bindable() }: { onopen?: () => void; onclose?: () => void; ondrag?: (info: SwipeInfo) => void; ondragend?: (info: SwipeInfo) => void; open?: boolean; stripEl?: HTMLDivElement } = $props();

    // keep the current tab and the previous one
    let held = $state<BottomTab[]>([]);
    let opened = false;
    function hold(tab: BottomTab) {
        held = [tab, ...held.filter((t) => t !== tab)].slice(0, 2);
    }
    function afterOpen(fn: () => void) {
        let idle = 0;
        let to = 0;
        const raf = requestAnimationFrame(() => {
            if (typeof requestIdleCallback === 'function') {
                idle = requestIdleCallback(fn, { timeout: 200 });
            }
            else {
                to = window.setTimeout(fn, 200);
            }
        });
        return () => {
            cancelAnimationFrame(raf);
            if (idle) {
                cancelIdleCallback(idle);
            }
            clearTimeout(to);
        };
    }
    $effect(() => {
        const tab = ui.bottomTab;
        const isOpen = open;
        const defer = ui.mobile;
        return untrack(() => {
            if (!isOpen) {
                opened = false;
                return;
            }
            if (held.includes(tab)) {
                opened = true;
                return;
            }
            if (opened || !defer) {
                hold(tab);
                opened = true;
                return;
            }
            return afterOpen(() => {
                hold(tab);
                opened = true;
            });
        });
    });
    function onYEnd(info: SwipeInfo, allowOpen = false) {
        if (ondragend) {
            ondragend(info);
        }
        else if (info.dir === 'down') {
            onclose?.();
        }
        else if (allowOpen && info.dir === 'up') {
            onopen?.();
        }
    }
    const modelOpts = $derived((paramState.models['Stable-Diffusion'] ?? []).map(([name]) => ({ value: cleanModelName(name), label: cleanModelName(name) })));
    const drawerItems = $derived<MenuItem[]>([
        { id: 'params', label: 'Parameters', onselect: () => { onclose?.(); ui.batchOpen = false; ui.paramsOpen = true; } },
        { id: 'output', label: 'Output', onselect: () => { onclose?.(); ui.paramsOpen = false; ui.batchOpen = true; } },
        { separator: true },
        ...tabs.map(t => ({
            id: t.id,
            label: t.label,
            checked: ui.bottomTab === t.id,
            onselect: () => {
                if (t.id === ui.bottomTab && open) {
                    onclose?.();
                }
                else {
                    ui.showBottom(t.id);
                    onopen?.();
                }
            },
        })),
    ]);
</script>

{#snippet selectors()}
    <span class="lbl">Model:</span>
    <div class="model">
        <Dropdown searchable id="model-select" ariaLabel="Model" options={modelOpts} value={paramState.values['model']} placeholder="Select a model…"
            onchange={(v: string) => selectModel(v)} />
    </div>
    {#if presetState.current.length}
        <div class="chips" role="group" aria-label="Current presets">
            {#each presetState.current as title (title)}
                <Chip label={title} removeLabel="Remove preset {title}" onremove={() => presetState.toggle(title)} />
            {/each}
        </div>
    {/if}
    <div class="loras"><LoraBar /></div>
{/snippet}

<section class="bottom" class:open aria-label="Browsers">
    {#if ui.mobile}
        <div class="strip mob" bind:this={stripEl} use:swipe={{ only: 'y', onmove: ondrag, onend: (info) => onYEnd(info, true) }}>
            <div class="rail" role="group" aria-label="Model and presets">{@render selectors()}</div>
            <div class="gen-row">
                <Menu items={drawerItems} label="Browsers">
                    {#snippet trigger(p)}<IconButton {...p} icon={LMenu} label="Browsers" pressed={open} />{/snippet}
                </Menu>
                <div class="gen"><GenerateControls block /></div>
            </div>
        </div>
    {:else}
        <div class="strip" bind:this={stripEl}>
            <div class="strip-main">
                <div class="info" role="group" aria-label="Model and presets">{@render selectors()}</div>
                <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events (clicks bubble from the tabs, which have their own keyboard handling) -->
                <div class="tabs" onclick={(e) => {
                    // only a tab toggles the drawer: clicks on the bar's empty space do nothing
                    const tab = (e.target as HTMLElement | null)?.closest('[role=tab]');
                    if (!tab) return;
                    if (tab.getAttribute('aria-selected') === 'true' && open) { onclose?.(); } else { onopen?.(); }
                }}><Tabs {tabs} value={ui.bottomTab} onchange={(id: string) => { ui.showBottom(id as BottomTab); onopen?.(); }} label="Browser" /></div>
            </div>
            <div class="gen"><GenerateControls /></div>
        </div>
    {/if}
    <div class="content" use:swipe={{ only: 'y', overscroll: 'top', onmove: ondrag, onend: (info) => onYEnd(info), enabled: open && ui.mobile }} inert={!open}>
        {#each held as tab (tab)}
            <div class="hold" class:on={tab === ui.bottomTab} inert={tab !== ui.bottomTab || !open}>
                {#if tab === 'history'}
                    <HistoryPage />
                {:else if tab === 'presets'}
                    {#await loadPresets() then PresetsPage}<PresetsPage />{/await}
                {:else if tab === 'tools'}
                    <ToolsPanel />
                {:else}
                    {#await loadModels() then ModelsPage}<ModelsPage subtype={tab} />{/await}
                {/if}
            </div>
        {/each}
    </div>
</section>

<style>
    .bottom { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .strip { flex: none; display: flex; align-items: stretch; }
    .strip-main { flex: 1 1 auto; min-width: 0; }
    .info { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); padding: var(--space-1) var(--space-2); }
    .model { width: 260px; max-width: 100%; }
    .lbl { white-space: nowrap; font-size: var(--font-size-sm); }
    .chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .loras { flex: 1 1 140px; min-width: 0; }
    .gen { flex: none; display: flex; align-items: stretch; padding: var(--space-1) var(--space-2) var(--space-1) 0; }
    .gen :global(.gc) { height: 100%; }
    .gen :global(.ui-split), .gen :global(.ui-split .ui-group-btns), .gen :global(.ui-split .ctl) { height: 100%; }
    .gen :global(.gc > .ctl) { height: 100%; }
    .gen :global(.gc > .int-btn) { width: auto; aspect-ratio: 1; }
    .tabs { padding: 0 var(--space-2) var(--space-1); }
    .content { flex: 1; min-height: 0; min-width: 0; overflow: hidden; overscroll-behavior-x: none; position: relative; }
    .hold { height: 100%; min-height: 0; min-width: 0; overflow: hidden; }
    .hold:not(.on) { visibility: hidden; position: absolute; inset: 0; pointer-events: none; content-visibility: hidden; }
    @media (max-width: 768px) {
        .bottom { height: 100%; min-height: 0; }
        .bottom:not(.open) .content { visibility: hidden; pointer-events: none; content-visibility: hidden; }
        .bottom.open { padding-bottom: env(safe-area-inset-bottom); }
        .bottom:not(.open) .strip.mob { padding-bottom: env(safe-area-inset-bottom); }
        .bottom.open .content { min-height: 0; background: var(--color-panel); overflow-x: hidden; overscroll-behavior: contain; overscroll-behavior-x: none; touch-action: pan-y; }
        .bottom.open .content :global(.list), .bottom.open .content :global(.tree) { overflow-x: hidden; overscroll-behavior-x: none; }
        .strip.mob { flex-direction: column; align-items: stretch; }
        .rail { display: flex; flex-wrap: nowrap; align-items: center; gap: var(--space-1) var(--space-2); min-width: 0; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; padding: var(--space-1) var(--space-2); }
        .rail .model { width: auto; min-width: 160px; max-width: none; flex: none; }
        .rail .chips { flex: none; flex-wrap: nowrap; }
        .rail :global(.loras) { flex: none; flex-wrap: nowrap; }
        .gen-row { display: flex; align-items: center; gap: var(--space-1); padding: 0 var(--space-2) var(--space-1); }
        .gen-row > :global(.inline-flex) > :global(.ctl) { width: 48px; min-width: 48px; }
        .gen-row .gen { flex: 1; min-width: 0; align-items: stretch; align-self: auto; padding: 0; }
        .gen-row :global(.gc),
        .gen-row :global(.ui-split),
        .gen-row :global(.ui-split .ui-group-btns),
        .gen-row :global(.ui-split .ctl),
        .gen-row :global(.gc > .ctl) { height: var(--size-control); }
        .gen-row :global(.gc.block),
        .gen-row :global(.gc.block .ui-split) { flex: 1; width: 100%; min-width: 0; }
    }
</style>
