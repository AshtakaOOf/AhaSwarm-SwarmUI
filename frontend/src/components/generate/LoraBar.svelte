<script lang="ts">
    import LPlus from '@lucide/svelte/icons/plus';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import { cleanModelName, LORA_CONFINEMENTS, paramState } from '../../lib/state/params.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { api } from '../../lib/api/swarm';
    import type { ModelInfo } from '../../lib/api/types';
    import { Button, Chip, Menu } from '../ui';
    import ModelInfoModal from '../models/ModelInfoModal.svelte';

    let { onbrowse }: { onbrowse?: () => void } = $props();
    const loras = $derived(paramState.loras);
    const letter = (v: number) => (LORA_CONFINEMENTS[v] === 'VideoSwap' ? 'S' : (LORA_CONFINEMENTS[v] ?? '?')[0]);
    const CONF_DESC: Record<number, string> = {
        0: 'Global - applies to every pass',
        5: 'Base - base pass only',
        1: 'Refiner - refiner/upscale pass only',
        2: 'Video - image-to-video pass only',
        3: 'VideoSwap - video swap pass only',
    };
    const confItems = (name: string, cur: number) => Object.entries(LORA_CONFINEMENTS).map(([v, l]) => ({
        label: `${letter(Number(v))} - ${CONF_DESC[Number(v)] ?? l}`, checked: Number(v) === cur, onselect: () => paramState.setLoraConfinement(name, Number(v)) }));

    let info = $state<ModelInfo | null>(null);
    async function openInfo(name: string) {
        try {
            info = (await api.describeModel(name, 'LoRA')).model;
        }
        catch (e) {
            ui.error(e);
        }
    }
    const isStarred = (m: ModelInfo) => (presetState.userData?.starred_models?.['LoRA'] ?? []).includes(m.name);
    const isActive = (m: ModelInfo) => paramState.loras.some(l => l.name === cleanModelName(m.name));
    async function toggleStar(m: ModelInfo) {
        const all = { ...(presetState.userData?.starred_models ?? {}) };
        const list = (all['LoRA'] ?? []).filter(n => n !== m.name);
        if (!isStarred(m)) list.push(m.name);
        if (list.length) all['LoRA'] = list;
        else delete all['LoRA'];
        if (presetState.userData) presetState.userData.starred_models = all;
        try {
            await api.setStarredModels(all);
        }
        catch (e) {
            ui.error(e);
        }
    }
</script>

{#if paramState.byId['loras']}
    <div class="loras" role="group" aria-label="Selected LoRAs">
        {#each loras as l (l.name)}
            <span class="lora">
                <Chip label={l.name} weight={l.weight} onclick={() => openInfo(l.name)}
                    removeLabel="Remove {l.name}" onweightchange={(w: number) => paramState.setLoraWeight(l.name, Number.isFinite(w) ? w : 1)}
                    onremove={() => paramState.toggleLora(l.name)}>
                    {#snippet prefix()}
                        {#if paramState.byId['lorasectionconfinement']}
                            <Menu items={confItems(l.name, Number(l.confinement))} label="LoRA mode for {l.name}">
                                {#snippet trigger(p)}<button {...p} type="button" class="mode" title="Mode: {CONF_DESC[Number(l.confinement)] ?? LORA_CONFINEMENTS[Number(l.confinement)] ?? l.confinement} (click to change)" aria-label="LoRA mode for {l.name}: {LORA_CONFINEMENTS[Number(l.confinement)]}"><span class="mode-letter">{letter(Number(l.confinement))}</span><ChevronDown size={15} strokeWidth={2.5} aria-hidden="true" /></button>{/snippet}
                            </Menu>
                        {/if}
                    {/snippet}
                </Chip>
            </span>
        {/each}
        {#if !loras.length}<Button variant="ghost" icon={LPlus} onclick={() => (onbrowse ? onbrowse() : ui.showBottom('LoRA'))}>Add LoRA</Button>{/if}
    </div>
{/if}

{#if info}
    <ModelInfoModal model={info} subtype="LoRA" starred={isStarred(info)} active={isActive(info)} actionLabel={isActive(info) ? 'Remove LoRA' : 'Add LoRA'}
        onuse={() => paramState.toggleLora(info!.name, info!)} onstar={() => toggleStar(info!)} onclose={() => (info = null)} />
{/if}

<style>
    .loras { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); min-width: 0; }
    .lora { display: inline-flex; align-items: center; }
    .lora :global(.chip) { gap: 0; padding: 0; background: transparent; }
    .lora :global(.chip > .chip-label) { height: 100%; padding: 0 6px; background: var(--color-raised); border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
    .lora :global(.chip > .chip-label:hover) { background: var(--color-hover); }
    .lora :global(.chip .ui-num) { background: var(--color-raised); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
    .lora :global(.chip > button:last-child) { margin-left: 1px; background: var(--color-danger); border-radius: var(--radius-sm); padding: 0 4px; opacity: 1; color: var(--color-danger-fg); }
    .lora :global(.chip > button:last-child:hover) { background: var(--color-danger-hover); color: var(--color-danger-fg); }
    .mode { align-self: stretch; min-width: 24px; padding: 4px 4px 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between; line-height: 1; font-size: var(--text-small); font-weight: 600; color: var(--color-ink-2); background: var(--color-raised); border-radius: var(--radius-sm); }
    .mode-letter { line-height: 1; }
    .mode :global(svg) { display: block; opacity: 0.7; }
    .mode:hover, .mode[aria-expanded='true'] { background: var(--color-hover); color: var(--color-ink); }
    .mode:active { transform: scale(0.94); }
    .lora :global(.chip > span:has(> .mode)) { display: flex; align-self: stretch; margin-right: 1px; }
</style>
