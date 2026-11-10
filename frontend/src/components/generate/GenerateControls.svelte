<script lang="ts">
    import LStopG from '@lucide/svelte/icons/circle-stop';
    import LX from '@lucide/svelte/icons/x';
    import { gen } from '../../lib/state/gen.svelte';
    import { paramState } from '../../lib/state/params.svelte';
    import { toolState } from '../../lib/state/tools.svelte';
    import { Button, IconButton, SplitButton, type MenuItem } from '../ui';

    let { block = false }: { block?: boolean } = $props();
    const queued = $derived(gen.running.length);
    const pct = $derived(gen.progress ? Math.round(gen.progress.overall * 100) : 0);
    const toolLabel = $derived(toolState.runnable === 'grid' ? 'Generate Grid' : toolState.runnable === 'batch' ? 'Run Batch' : 'Generate');
    let genMenuOpen = $state(false);
    const genItems = $derived<MenuItem[]>([
        { label: 'Generate Forever', checked: gen.forever, title: 'Keep generating until stopped', onselect: () => gen.setForever(!gen.forever) },
        { label: 'Generate Previews', checked: gen.previews, title: 'Keep generating cheap previews (using a "Preview" preset) as you change parameters', onselect: () => gen.setPreviews(!gen.previews) },
        { label: 'Interrupt And Generate', danger: true, shortcut: 'Alt+Click', onselect: () => gen.interrupt().then(() => gen.generate()) },
        { separator: true },
        { label: 'Interrupt Current Session', icon: LX, danger: true, disabled: !queued, onselect: () => gen.interrupt() },
        { label: 'Interrupt All Sessions', icon: LX, danger: true, title: 'Interrupt generations from all your sessions', onselect: () => gen.interrupt(true) },
    ]);
</script>

<div class="gc" class:block role="group" aria-label="Generate controls">
    {#if gen.forever}<Button variant="danger" icon={LStopG} onclick={() => gen.setForever(false)}>Stop Forever</Button>{/if}
    {#if gen.previews}<Button variant="danger" icon={LStopG} onclick={() => gen.setPreviews(false)}>Stop Previews</Button>{/if}
    {#if queued}<IconButton variant="danger" class="int-btn" icon={LX} label="Interrupt" onclick={() => gen.interrupt()} />{/if}
    <SplitButton variant="primary" class="gen-btn" block items={genItems} menuLabel="Generate options" contextMenu bind:open={genMenuOpen}
        onclick={(e: MouseEvent) => {
            const go = () => (toolState.runnable ? toolState.run() : gen.generate());
            if (e.altKey) { void gen.interrupt().then(go); } else { go(); }
        }} disabled={!paramState.loaded}>
        <span class="tabular-nums">{queued ? `${toolLabel} - ${queued} running - ${pct}%` : toolLabel}</span>
    </SplitButton>
</div>

<style>
    .gc { display: flex; align-items: center; gap: var(--space-1); min-width: 0; }
    .gc :global(.gen-btn) { min-width: 120px; }
    .block { flex: 1; }
    .gc:not(.block) :global(.ui-split) { flex: none; }
    .block :global(.ui-split) { flex: 1; }
</style>
