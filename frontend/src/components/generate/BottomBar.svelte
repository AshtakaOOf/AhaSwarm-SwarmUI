<script lang="ts">
    import { hasPermission } from '../../lib/api/swarm';
    import { ui, type BottomTab } from '../../lib/state/ui.svelte';
    import { toolState } from '../../lib/state/tools.svelte';
    import { cleanModelName, paramState } from '../../lib/state/params.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { selectModel } from '../../lib/state/models';
    import { Tabs, Dropdown, Chip } from '../ui';
    import LoraBar from './LoraBar.svelte';
    import GenerateControls from './GenerateControls.svelte';
    import HistoryPage from '../history/HistoryPage.svelte';
    import PresetsPage from '../presets/PresetsPage.svelte';
    import ModelsPage from '../models/ModelsPage.svelte';
    import ToolsPanel from './ToolsPanel.svelte';

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
    let { onopen, onclose, open = false, stripEl = $bindable() }: { onopen?: () => void; onclose?: () => void; open?: boolean; stripEl?: HTMLDivElement } = $props();
    const modelOpts = $derived((paramState.models['Stable-Diffusion'] ?? []).map(([name]) => ({ value: cleanModelName(name), label: cleanModelName(name) })));
</script>

{#snippet infoBar()}
    <div class="info" role="group" aria-label="Model and presets">
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
    </div>
{/snippet}

<section class="bottom" aria-label="Browsers">
    <div class="strip" bind:this={stripEl}>
        <div class="strip-main">
            {@render infoBar()}
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
    <div class="content">
        {#if ui.bottomTab === 'history'}
            <HistoryPage />
        {:else if ui.bottomTab === 'presets'}
            <PresetsPage />
        {:else if ui.bottomTab === 'tools'}
            <ToolsPanel />
        {:else}
            {#key ui.bottomTab}<ModelsPage subtype={ui.bottomTab} />{/key}
        {/if}
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
    .content { flex: 1; min-height: 0; overflow: hidden; }
</style>
