<script lang="ts">
    import LImage from '@lucide/svelte/icons/image';
    import { gen } from '../../lib/state/gen.svelte';
    import { batchSettings } from '../../lib/state/batch.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { resolveUrl } from '../../lib/api/client';
    import { mediaType, fileName } from '../../lib/util/metadata';
    import { readFileMetadata } from '../../lib/util/fileMeta';
    import { fileToDataUrl } from '../../lib/util/metadata';
    import { ProgressBar, EmptyState, VideoPlayer, AudioPlayer } from '../ui';
    import MetadataView from './MetadataView.svelte';
    import ImageActions from './ImageActions.svelte';
    import EditorButton from './EditorButton.svelte';

    const cur = $derived(gen.current);
    const src = $derived(cur ? resolveUrl(cur.src) : '');
    const kind = $derived(cur ? mediaType(cur.src) : 'image');
    const isData = $derived(!!cur?.src?.startsWith('data:'));
    const showPreview = $derived(!!gen.livePreview && gen.running.length > 0 && (batchSettings.values.autoSwapPreviews || !gen.current));
    let dropping = $state(false);
    let ar = $state(1), sw = $state(0), sh = $state(0);
    const side = $derived(ar <= 1.2);
    const ov = $derived.by(() => {
        const P = 4, w = Math.max(0, sw - 2 * P), h = Math.max(0, sh - 2 * P);
        if (!w || !h || ui.settings.imageFit === 'cover' || kind !== 'image') return `left:${P + 4}px;top:${P + 4}px`;
        const dw = Math.min(w, h * ar), dh = Math.min(h, w / ar);
        return `left:${Math.round(P + (w - dw) / 2 + 6)}px;top:${Math.round(P + (h - dh) / 2 + 6)}px;max-width:${Math.round(dw - 12)}px`;
    });
    async function ondrop(e: DragEvent) {
        dropping = false;
        const file = e.dataTransfer?.files?.[0];
        if (!file) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const isJson = file.name.endsWith('.json') || file.type === 'application/json';
        if (!isJson && !/^(image|video|audio)\//.test(file.type)) {
            return;
        }
        const metadata = file.type.startsWith('image/') || isJson ? await readFileMetadata(file) : null;
        if (isJson) {
            if (!metadata) {
                ui.toast('That JSON file has no SwarmUI metadata.', 'warning');
                return;
            }
            gen.setCurrent('imgs/model_placeholder.jpg', metadata, 'dropped');
            return;
        }
        gen.setCurrent(await fileToDataUrl(file), metadata, 'dropped');
        if (file.type.startsWith('image/') && !metadata) {
            ui.toast('No SwarmUI metadata found in that image.', 'info');
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section class="cur" class:dropping aria-label="Current image" {ondrop}
    ondragover={(e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); dropping = true; } }} ondragleave={() => (dropping = false)}>
    <div class="body" class:side>
        <div class="stage" class:cover={ui.settings.imageFit === 'cover'} bind:clientWidth={sw} bind:clientHeight={sh}>
            {#if showPreview}
                <img src={gen.livePreview} alt="Live preview" />
            {:else if cur}
                {#if kind === 'video'}
                    <VideoPlayer {src} muted label={fileName(cur.src)} />
                {:else if kind === 'audio'}
                    <AudioPlayer {src} label={fileName(cur.src)} />
                {:else}
                    <button class="imgbtn" onclick={() => (ui.fullView = { src: cur.src, metadata: cur.metadata })}>
                        <img src={src} alt={fileName(cur.src)} onload={(e) => { const i = e.currentTarget as HTMLImageElement; if (i.naturalWidth && i.naturalHeight) ar = i.naturalWidth / i.naturalHeight; }} />
                    </button>
                {/if}
            {/if}
            {#if cur && !showPreview && ui.settings.imageActions !== 'above-metadata'}<div class="over" style={ov}><ImageActions item={cur} /></div>{/if}
            {#if !cur}
                <div class="edit"><EditorButton icon /></div>
            {/if}
            {#if !cur && !showPreview}
                <EmptyState icon={LImage} title="Ready to generate" message="Select a model in the Models tab below, write a prompt and press Generate." />
            {/if}
        </div>
        {#if cur && !showPreview}
            <div class="extras">
                {#if ui.settings.imageActions === 'above-metadata'}<ImageActions item={cur} />{/if}
                <div class="meta"><MetadataView metadata={cur.metadata} /></div>
            </div>
        {/if}
    </div>
    {#if gen.progress}
        <div class="prog">
            <ProgressBar value={gen.progress.overall} showValue label="Overall: step {Math.round(gen.progress.current * 100)}% - {gen.progress.count} image{gen.progress.count === 1 ? '' : 's'}" />
        </div>
    {/if}
</section>

<style>
    .cur { height: 100%; display: flex; flex-direction: column; min-height: 0; container-type: size; }
    .body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .stage { position: relative; flex: 1 1 60%; min-height: 120px; display: flex; align-items: center; justify-content: center; padding: var(--space-1); overflow: hidden; }
    .imgbtn { all: unset; display: block; width: 100%; height: 100%; cursor: zoom-in; }
    .imgbtn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
    .stage img, .stage :global(.ui-video) { width: 100%; height: 100%; object-fit: contain; display: block; }
    .stage { --vp-clear-x: 30px; --vp-clear-b: 30px; }
    .stage :global(.ui-audio) { max-width: calc(100% - 60px); }
    .stage.cover img { object-fit: cover; }
    .extras { flex: 0 1 auto; min-height: 0; max-height: 40%; display: flex; flex-direction: column; gap: var(--space-1); padding: 0 var(--space-2) var(--space-1); }
    .over { position: absolute; z-index: 2; }
    .edit { position: absolute; z-index: 2; top: var(--space-2); right: var(--space-2); display: flex; align-items: center; gap: var(--space-1); }
    .dropping { background: var(--color-control-active); }
    .meta { min-height: 0; overflow: auto; }
    .prog { padding: 0 var(--space-2) var(--space-1); }
    /* portrait / square image and room for it: metadata column to the right; otherwise (landscape or narrow) below */
    @container (min-width: 440px) {
        .body.side { flex-direction: row; }
        .body.side .stage { flex: 1 1 auto; }
        .body.side .extras { flex: 0 0 clamp(220px, 36%, 420px); max-height: none; padding: var(--space-2); overflow: hidden; }
    }
</style>
