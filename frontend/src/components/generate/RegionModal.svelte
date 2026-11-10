<script lang="ts">
    import LSquareDashed from '@lucide/svelte/icons/square-dashed';
    import { paramState } from '../../lib/state/params.svelte';
    import { Button, Dropdown, FormRow, Modal, Slider, Textarea, Toggle } from '../ui';

    let { open = $bindable(false), oninsert }: { open?: boolean; oninsert: (text: string) => void } = $props();

    const TYPES = [{ value: 'region', label: 'Classic Regions' }, { value: 'ideogram', label: 'Ideogram JSON Elements' }];
    let type = $state(localStorage.getItem('ahaswarm.region.type') === 'ideogram' ? 'ideogram' : 'region');
    let x = $state(0.25), y = $state(0.25), w = $state(0.5), h = $state(0.5);
    let strength = $state(0.5);
    let inpaint = $state(false);
    let inpaintStrength = $state(0.5);
    let prompt = $state('');

    $effect(() => {
        if (open) {
            x = 0.25; y = 0.25; w = 0.5; h = 0.5; strength = 0.5; inpaint = false; inpaintStrength = 0.5; prompt = '';
        }
    });
    $effect(() => localStorage.setItem('ahaswarm.region.type', type));

    const aspect = $derived.by(() => {
        const pw = Number(paramState.values['width']) || 1024, ph = Number(paramState.values['height']) || 1024;
        return pw / ph;
    });

    const round = (v: number) => Math.round(v * 100) / 100;
    const clamp = (v: number, max = 1) => Math.max(0, Math.min(max, v));
    // preview fits a 280px square at the generation aspect ratio
    const FRAME = 280;
    const frameW = $derived(aspect >= 1 ? FRAME : Math.round(FRAME * aspect));
    const frameH = $derived(aspect >= 1 ? Math.round(FRAME / aspect) : FRAME);
    // drag: 0-3 corners (tl, tr, bl, br) resize, 4 moves the box keeping the grab offset
    let drag = $state<number | null>(null);
    let grab = { dx: 0, dy: 0 };
    let area: HTMLDivElement | undefined = $state();
    function point(e: PointerEvent): [number, number] {
        const r = area!.getBoundingClientRect();
        return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
    }
    function down(id: number, e: PointerEvent) {
        if (!area || e.button !== 0) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const [px, py] = point(e);
        grab = { dx: px - x, dy: py - y };
        drag = id;
        area.setPointerCapture(e.pointerId);
    }
    function move(e: PointerEvent) {
        if (drag === null || !area) {
            return;
        }
        const [px, py] = point(e);
        if (drag === 4) {
            x = round(clamp(px - grab.dx, 1 - w));
            y = round(clamp(py - grab.dy, 1 - h));
            return;
        }
        let x1 = x, y1 = y, x2 = x + w, y2 = y + h;
        if (drag === 0 || drag === 2) { x1 = round(px); } else { x2 = round(px); }
        if (drag === 0 || drag === 1) { y1 = round(py); } else { y2 = round(py); }
        if (x1 < x2) {
            x = round(x1); w = round(x2 - x1);
        }
        if (y1 < y2) {
            y = round(y1); h = round(y2 - y1);
        }
    }
    const corners = $derived([[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([cx, cy]) => [clamp(cx), clamp(cy)]));

    function submit() {
        const cx = clamp(x), cy = clamp(y);
        const cw = clamp(w + cx) - cx, ch = clamp(h + cy) - cy;
        const text = prompt.trim();
        open = false;
        if (type === 'ideogram') {
            oninsert(`{"type": "obj", "bbox": [${Math.round(cy * 1000)}, ${Math.round(cx * 1000)}, ${Math.round((cy + ch) * 1000)}, ${Math.round((cx + cw) * 1000)}], "desc": "${text}"}`);
            return;
        }
        const key = inpaint ? 'object' : 'region';
        oninsert(`<${key}:${round(cx)},${round(cy)},${round(cw)},${round(ch)},${strength}${inpaint ? `,${inpaintStrength}` : ''}> ${text}`);
    }
</script>

<Modal bind:open tone="panel" title="Add Prompt Syntax: Regional Prompt" size="lg" class="region-modal">
    <p class="aha-muted">Gives a box of the image its own prompt during generation, optionally auto-inpainting it after. Add <code>&lt;region:background&gt;</code> to also prompt the background only.
        <a href="https://github.com/mcmonkeyprojects/SwarmUI/blob/master/docs/Features/Prompt%20Syntax.md#regional-prompting" target="_blank" rel="noreferrer noopener">Swarm docs</a></p>
    <div class="aha-form ui-dense">
        <FormRow label="Region Type" info={'Classic Regions writes <region:…> (or <object:…> when inpainting).\nIdeogram JSON Elements writes a bbox element for Ideogram-style JSON prompts.'}><Dropdown ariaLabel="Region type" options={TYPES} bind:value={type} /></FormRow>
    </div>
    <div class="layout">
        <div class="frame" style:width="{frameW}px" style:height="{frameH}px">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="area" bind:this={area} onpointermove={move} onpointerup={() => (drag = null)} onpointercancel={() => (drag = null)}>
                <div class="rect" class:on={drag === 4} style:left="{clamp(x) * 100}%" style:top="{clamp(y) * 100}%"
                    style:width="{(clamp(x + w) - clamp(x)) * 100}%" style:height="{(clamp(y + h) - clamp(y)) * 100}%" onpointerdown={(e) => down(4, e)}></div>
                {#each corners as [hx, hy], i (i)}
                    <div class="hdl" class:on={drag === i} class:ne={i === 1 || i === 2} style:left="{hx * 100}%" style:top="{hy * 100}%" onpointerdown={(e) => down(i, e)}></div>
                {/each}
            </div>
        </div>
        <div class="aha-form ui-dense fields">
            <Slider label="Left X" info="The left X coordinate of the region's box." bind:value={x} min={0} max={1} step={0.01} defaultValue={0.25} />
            <Slider label="Top Y" info="The top Y coordinate of the region's box." bind:value={y} min={0} max={1} step={0.01} defaultValue={0.25} />
            <Slider label="Width" info="The width of the region's box." bind:value={w} min={0} max={1} step={0.01} defaultValue={0.5} />
            <Slider label="Height" info="The height of the region's box." bind:value={h} min={0} max={1} step={0.01} defaultValue={0.5} />
            {#if type === 'region'}
                <Slider label="Strength" info={'How strongly to apply the prompt to the region (vs the global prompt).\n0 is no effect, 1 is full effect.'} bind:value={strength} min={0} max={1} step={0.01} defaultValue={0.5} />
                <FormRow label="Do Inpaint" info="Also inpaint the region with this prompt after generating (writes <object:…>)."><Toggle hideLabel label="Do inpaint" bind:checked={inpaint} /></FormRow>
                {#if inpaint}
                    <Slider label="Inpaint Strength" info={'How strongly to inpaint the region (InitImageCreativity).\n0 is no inpainting, 1 is full inpainting.'} bind:value={inpaintStrength} min={0} max={1} step={0.01} defaultValue={0.5} />
                {/if}
            {/if}
        </div>
    </div>
    <div class="aha-form ui-dense">
        <FormRow label="Generation Prompt" info={'The prompt for this region.\nShould be a full text on its own; a subset of prompt syntax works.'}><Textarea bind:value={prompt} aria-label="Region prompt" rows={2} placeholder="Type your generation prompt here..." onsubmit={submit} /></FormRow>
    </div>
    {#snippet footer()}
        <Button onclick={() => (open = false)}>Cancel</Button>
        <Button variant="primary" icon={LSquareDashed} onclick={submit}>Add</Button>
    {/snippet}
</Modal>

<style>
    :global(.region-modal.lg) { max-width: 720px; }
    .layout { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--space-3); margin: var(--space-2) 0; }
    .frame { position: relative; flex: none; max-width: 100%; box-sizing: content-box; padding: 6px; overflow: hidden; background: var(--color-base); border: 1px solid var(--edge-strong); border-radius: var(--radius-sm); }
    .area { position: relative; width: 100%; height: 100%; touch-action: none; user-select: none; }
    .rect { position: absolute; box-sizing: border-box; background: var(--color-accent-soft); border: 1px solid var(--color-accent); cursor: move; }
    .rect.on { background: color-mix(in srgb, var(--color-accent) 30%, transparent); }
    .hdl { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--color-accent); cursor: nwse-resize; }
    .hdl.ne { cursor: nesw-resize; }
    .hdl:hover, .hdl.on { box-shadow: 0 0 0 3px var(--color-accent-soft); }
    .fields { flex: 1 1 260px; min-width: 0; }
</style>
