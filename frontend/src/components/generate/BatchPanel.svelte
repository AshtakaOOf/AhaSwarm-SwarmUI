<script lang="ts">
    import LEraser from '@lucide/svelte/icons/eraser';
    import LSettings from '@lucide/svelte/icons/settings-2';
    import LEllipsis from '@lucide/svelte/icons/ellipsis';
    import { gen, type OutputImage, type Slot } from '../../lib/state/gen.svelte';
    import { BATCH_OPTIONS, BATCH_SIZE, batchSettings } from '../../lib/state/batch.svelte';
    import { resolveUrl } from '../../lib/api/client';
    import { mediaType } from '../../lib/util/metadata';
    import { ui } from '../../lib/state/ui.svelte';
    import { imageMenuItems } from '../../lib/state/imageMenu';
    import { GalleryCard, IconButton, Menu, Popover, Slider, SwitchRow, Toolbar, type MenuItem } from '../ui';

    const opts = $derived(batchSettings.values);
    type Pending = { slot: Slot; ratio?: string };
    const pendingOf = (j: (typeof gen.jobs)[number]): Pending[] =>
        Object.values(j.slots).filter(s => !s.done).sort((a, b) => b.index - a.index).map(slot => ({ slot, ratio: j.ratio }));
    const pending = $derived(gen.running.flatMap(pendingOf));
    const groups = $derived.by(() => {
        const list = gen.batchGroups.map(g => ({ ...g, pending: [] as Pending[] }));
        if (!opts.separateBatches) {
            if (pending.length) {
                if (!list.length) list.push({ jobId: 0, sets: [], pending: [] });
                list[0].pending = pending;
            }
            return list;
        }
        for (const j of gen.running) {
            const p = pendingOf(j);
            if (!p.length) continue;
            let g = list.find(x => x.jobId === j.id);
            if (!g) {
                g = { jobId: j.id, sets: [], pending: [] };
                const at = list.findIndex(x => x.jobId < j.id);
                list.splice(at < 0 ? list.length : at, 0, g);
            }
            g.pending = p;
        }
        return list;
    });
    const empty = $derived(!pending.length && !gen.outputs.length);
    let settingsOpen = $state(false);

    let menu: Menu | undefined = $state();
    let menuItems = $state<MenuItem[]>([]);
    function openMenu(o: OutputImage, x: number, y: number) {
        menuItems = imageMenuItems(o);
        menu?.openAt(x, y);
    }
    function pick(o: OutputImage) {
        if (gen.current?.src === o.src) {
            ui.fullView = { src: o.src, metadata: o.metadata }; // classic clickImageInBatch: a second click opens it
        }
        else {
            gen.current = o;
        }
    }

    function clear() {
        gen.outputs = [];
        gen.clearQueueHistory();
    }
</script>

{#snippet output(o: OutputImage)}
    <GalleryCard src={resolveUrl(o.src)} video={mediaType(o.src) === 'video'} autoplay={opts.playVideos} aspect="auto" ratio={o.ratio} rowHeight="var(--batch-row)"
        alt={o.intermediate ? 'Intermediate output' : o.grid ? 'Grid' : `Output ${o.batch}`} badge={o.intermediate ? 'Intermediate' : o.grid ? 'Grid' : undefined}
        selected={gen.current?.src === o.src} onclick={() => pick(o)}
        oncontextmenu={(e: MouseEvent) => { if (e.shiftKey || e.ctrlKey) return; e.preventDefault(); openMenu(o, e.clientX, e.clientY); }}>
        {#snippet overlay()}
            <IconButton size="sm" icon={LEllipsis} label="Image actions"
                onclick={(e: MouseEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(o, r.left, r.bottom); }} />
        {/snippet}
    </GalleryCard>
{/snippet}

<aside class="batch" aria-label="Current batch" style:--batch-row="{batchSettings.imageSize}px">
    <Toolbar label="Current batch">
        <h3 class="title text-small font-normal text-ink-3 uppercase">Output</h3>
        <span class="spacer"></span>
        <Popover bind:open={settingsOpen} title="Output options" label="Output options" compact>
            {#snippet trigger(p)}<IconButton {...p} icon={LSettings} label="Output options" pressed={settingsOpen} />{/snippet}
            <div class="opts ui-dense">
                <div class="size">
                    <Slider label="Image size" info="Height of the images in the Output section, in pixels. Each image keeps its own aspect ratio." min={BATCH_SIZE.min} max={BATCH_SIZE.max} step={BATCH_SIZE.step} defaultValue={BATCH_SIZE.default}
                        value={batchSettings.imageSize} oninput={(v) => batchSettings.setImageSize(v)} onchange={(v) => batchSettings.setImageSize(v)} />
                </div>
                {#each BATCH_OPTIONS as o (o.key)}
                    <SwitchRow label={o.label} info={o.description} checked={opts[o.key]} onchange={(v) => batchSettings.set(o.key, v)} />
                {/each}
            </div>
        </Popover>
        <!-- classic clear_batch_button: clears without asking -->
        <IconButton variant="danger" icon={LEraser} label="Clear batch" disabled={!gen.outputs.length && !gen.jobs.length} onclick={clear} />
    </Toolbar>
    <div class="list">
        {#if empty}
            <p class="hint">Generated images appear here.</p>
        {/if}
        {#each groups as g (g.jobId)}
            <div class="grid" class:sep={opts.separateBatches}>
                {#each g.pending as p (p.slot.key)}
                    <GalleryCard src={p.slot.preview ?? ''} live busy={opts.showSpinners} alt="Generating" aspect="auto" ratio={p.ratio} rowHeight="var(--batch-row)" badge="{Math.round(p.slot.overall * 100)}%" />
                {/each}
                {#each g.sets as s (s[0].set ?? s[0].src + s[0].jobId)}
                    {#if s.length > 1}
                        <div class="set" role="group" aria-label="Image {s[0].batch} and its intermediates">
                            {#each s as o (o.src + o.jobId + o.batch)}{@render output(o)}{/each}
                        </div>
                    {:else}{@render output(s[0])}{/if}
                {/each}
            </div>
        {/each}
    </div>
    <Menu bind:this={menu} items={menuItems} label="Image actions" />
</aside>

<style>
    .batch { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .batch > :global(.ui-toolbar) { min-height: var(--size-control); padding: var(--space-2) var(--space-2) 0; box-sizing: content-box; gap: var(--space-1); }
    .spacer { flex: 1; }
    .title { margin: 0; }
    .list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: var(--space-2); }
    .grid { display: flex; flex-wrap: wrap; align-content: flex-start; gap: var(--space-1); padding: var(--space-1) var(--space-2) 0; }
    .grid.sep + .grid.sep { margin-top: var(--space-1); border-top: 1px solid var(--color-hover); padding-top: var(--space-2); }
    .set { flex: 1 0 100%; box-sizing: border-box; display: flex; flex-wrap: wrap; align-content: flex-start; gap: var(--space-1);
        padding: var(--space-1); margin: 0 calc(-1 * var(--space-1)); border-radius: var(--radius-ui); background: var(--color-veil); box-shadow: inset 0 0 0 1px var(--color-border); }
    .set + .set { margin-top: var(--space-1); }
    .hint { margin: 2px 0; padding: 0 var(--space-2); font-size: var(--text-mini, 11px); color: var(--color-ink-3); opacity: 0.7; }
    .opts { display: flex; flex-direction: column; gap: 2px; width: 230px; max-width: 100%; }
    .size { display: flex; flex-direction: column; gap: 1px; padding-left: var(--space-0); margin-bottom: var(--space-1); }
    .opts :global(.ui-switch-row) { gap: var(--space-2); padding-left: var(--space-0); }
</style>
