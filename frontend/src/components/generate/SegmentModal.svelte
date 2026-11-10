<script lang="ts">
    import LScanFace from '@lucide/svelte/icons/scan-face';
    import { untrack } from 'svelte';
    import { paramState } from '../../lib/state/params.svelte';
    import { Button, Dropdown, FormRow, Modal, NumberInput, Slider, TextInput, Textarea, Toggle } from '../ui';

    let { open = $bindable(false), oninsert }: { open?: boolean; oninsert: (text: string) => void } = $props();

    let model = $state('CLIP-Seg');
    let match = $state('');
    let yoloId = $state(0);
    let classIds = $state('');
    let creativity = $state(0.6);
    let threshold = $state(0.5);
    let invert = $state(false);
    let prompt = $state('');
    let useSampler = $state(false);
    let sampler = $state('');
    let useScheduler = $state(false);
    let scheduler = $state('');

    const choices = (id: string) => (paramState.byId[id]?.values ?? []).map((v, i) => ({ value: v, label: paramState.byId[id]?.value_names?.[i] || v }));
    const models = $derived([{ value: 'CLIP-Seg', label: 'CLIP-Seg (Match by prompting)' },
        ...(paramState.byId['yolomodelinternal']?.values ?? []).map(m => ({ value: `yolo-${m}`, label: `${m} (YOLOv8)` }))]);
    const samplers = $derived(choices('sampler'));
    const schedulers = $derived(choices('scheduler'));
    const clip = $derived(model === 'CLIP-Seg');
    const error = $derived(clip && !match.trim() ? 'Text Match is required when using CLIP-Seg' : '');

    // classic segmentModalClear: every open starts fresh
    $effect(() => {
        if (open) {
            untrack(reset);
        }
    });
    function reset() {
        model = 'CLIP-Seg'; match = ''; yoloId = 0; classIds = ''; creativity = 0.6; threshold = 0.5; invert = false; prompt = '';
        useSampler = false; sampler = `${paramState.values['sampler'] ?? samplers[0]?.value ?? ''}`;
        useScheduler = false; scheduler = `${paramState.values['scheduler'] ?? schedulers[0]?.value ?? ''}`;
    }

    function submit() {
        if (error) {
            return;
        }
        let target = model;
        if (clip) {
            target = match.trim();
        }
        else {
            if (yoloId > 0) {
                target += `-${yoloId}`;
            }
            if (classIds.trim()) {
                target += `:${classIds.trim()}:`;
            }
        }
        let extra = '';
        if (useSampler && sampler) {
            extra += `<param[sampler]:${sampler}>`;
        }
        if (useScheduler && scheduler) {
            extra += `<param[scheduler]:${scheduler}>`;
        }
        open = false;
        oninsert(`<segment:${target},${creativity},${invert ? '-' : ''}${threshold}>${extra} ${prompt.trim()}`);
    }
</script>

<Modal bind:open tone="panel" title="Add Prompt Syntax: Auto-Segment And Refine" size="md">
    <p class="aha-muted">Adds a region that is detected after generation and then inpainted with its own prompt. CLIP-Seg masks by a text match; a YOLOv8 model can be used instead.
        <a href="https://github.com/mcmonkeyprojects/SwarmUI/blob/master/docs/Features/Prompt%20Syntax.md#automatic-segmentation-and-refining" target="_blank" rel="noreferrer noopener">Swarm docs</a></p>
    <div class="aha-form ui-dense">
        <FormRow label="Model" info={'What model to find the segment with.\nCLIP-Seg is a special model that uses text prompt matching. You may instead use a YOLOv8 model.'}><Dropdown ariaLabel="Segment model" options={models} bind:value={model} searchable={models.length > 8} /></FormRow>
        {#if clip}
            <FormRow label="Text Match" info={"The text to match against in the image.\nFor example, 'face' or 'the man's face'."}><TextInput bind:value={match} aria-label="Text match" placeholder="Text to match against in the image" /></FormRow>
        {:else}
            <FormRow label="YOLO ID" info={'The ID of the match within the YOLO result to use.\n0 means all matches; 1 uses the first match it finds (eg the first face in a group).'}><NumberInput bind:value={yoloId} min={0} max={100} step={1} ariaLabel="YOLO ID" /></FormRow>
            <FormRow label="Class IDs" info={'For YOLO models with multiple classes, optionally a comma-separated list of class IDs.\nIDs can be numeric (eg 0, 1, 2) or text labels.'}><TextInput bind:value={classIds} aria-label="Class IDs" placeholder="Optional class IDs here..." /></FormRow>
        {/if}
        <Slider label="Creativity" info={'How creative the model should be when rebuilding this segment (denoising strength).\n0 makes no changes, 1 completely replaces the area.'} bind:value={creativity} min={0} max={1} step={0.05} defaultValue={0.6} />
        <Slider label="Threshold" info={'The minimum match quality for the model to consider this segment matched.\nAt 0 this includes too much, at 1 too little or nothing.'} bind:value={threshold} min={0} max={1} step={0.05} defaultValue={0.5} />
        <FormRow label="Invert Mask" info="Select everything except what the model matched."><Toggle hideLabel label="Invert mask" bind:checked={invert} /></FormRow>
        <FormRow label="Generation Prompt" info={'The prompt to use when regenerating the matched area.\nShould be a full text on its own; a subset of prompt syntax works.'}><Textarea bind:value={prompt} aria-label="Generation prompt" rows={2} placeholder="Type your generation prompt here..." onsubmit={submit} /></FormRow>
        {#if samplers.length}
            <FormRow label="Sampler" info={'Optional alternate sampler for regenerating the matched area.\nIf off, the main sampler param is used.'}><div class="opt"><Toggle hideLabel label="Use a segment sampler" bind:checked={useSampler} /><Dropdown ariaLabel="Segment sampler" options={samplers} bind:value={sampler} disabled={!useSampler} searchable /></div></FormRow>
        {/if}
        {#if schedulers.length}
            <FormRow label="Scheduler" info={'Optional alternate scheduler for regenerating the matched area.\nIf off, the main scheduler param is used.'}><div class="opt"><Toggle hideLabel label="Use a segment scheduler" bind:checked={useScheduler} /><Dropdown ariaLabel="Segment scheduler" options={schedulers} bind:value={scheduler} disabled={!useScheduler} searchable /></div></FormRow>
        {/if}
    </div>
    {#snippet footer()}
        {#if error}<span class="err">{error}</span>{/if}
        <Button onclick={() => (open = false)}>Cancel</Button>
        <Button variant="primary" icon={LScanFace} disabled={!!error} onclick={submit}>Add</Button>
    {/snippet}
</Modal>

<style>
    .opt { display: flex; align-items: center; gap: var(--space-1); }
    .opt > :global(:last-child) { flex: 1; min-width: 0; }
    .err { flex: 1; align-self: center; color: var(--color-danger-fg); font-size: var(--text-small); }
</style>
