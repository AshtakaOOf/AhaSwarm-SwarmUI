<script lang="ts">
    import { toolState, type ToolId } from '../../lib/state/tools.svelte';
    import { Dropdown } from '../ui';
    import { lazy } from '../../lib/util/lazy';

    const loadGrid = lazy(() => import('./GridTool.svelte'));
    const loadBatch = lazy(() => import('./BatchTool.svelte'));
    const loadComfy = lazy(() => import('./ComfyTool.svelte'));

    const options = $derived([{ value: '', label: 'None' }, ...toolState.available().map(t => ({ value: t.id, label: t.label }))]);
    // a tool the user can't open any more (permissions or backends changed) is turned off
    $effect(() => {
        if (toolState.id && !options.some(o => o.value === toolState.id)) toolState.id = '';
    });
    // the ComfyUI iframe stays mounted after its first open, so switching tools doesn't reload the graph
    let comfyEver = $state(false);
    $effect(() => { if (toolState.id === 'comfy') comfyEver = true; });
    $effect(() => { if (toolState.id !== 'comfy' && toolState.comfyFull) toolState.comfyFull = false; });
</script>

<div class="aha-page tools">
    <div class="aha-acts ui-dense pick">
        <span class="aha-muted">Tool</span>
        <div class="sel"><Dropdown ariaLabel="Tool" {options} value={toolState.id} onchange={(v: string) => (toolState.id = v as ToolId)} /></div>
    </div>
    {#if toolState.id === 'grid'}<div class="aha-body aha-secs">{#await loadGrid() then GridTool}<GridTool />{/await}</div>
    {:else if toolState.id === 'batch'}<div class="aha-body aha-secs">{#await loadBatch() then BatchTool}<BatchTool />{/await}</div>
    {:else if !toolState.id}<p class="aha-muted">Pick a tool. Grid Generator and Image Edit Batcher then run from the Generate button with the current parameters; None turns tools off.</p>{/if}
    {#if comfyEver}<div class="comfy-slot" class:on={toolState.id === 'comfy'}>{#await loadComfy() then ComfyTool}<ComfyTool visible={toolState.id === 'comfy' || toolState.comfyFull} />{/await}</div>{/if}
</div>

<style>
    .tools { background: none; }
    .pick { flex: none; }
    .sel { width: 220px; }
    .comfy-slot { display: none; }
    .comfy-slot.on { display: flex; flex: 1; min-height: 0; flex-direction: column; padding-bottom: var(--param-gutter); }
</style>
