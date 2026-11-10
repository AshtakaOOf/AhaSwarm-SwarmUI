<script lang="ts">
    import { formatClass } from '../../lib/util/browserFormat';
    import { Skeleton } from '../ui';

    let { format, label = 'Loading' }: { format: string; label?: string } = $props();
    const kind = $derived(formatClass(format));
    const count = $derived(kind.includes('bf-cards') ? 8 : kind.includes('bf-thumbs') ? 48 : 30);
</script>

<div class="skel" role="status" aria-label={label} aria-busy="true">
    <div class={kind}>
        {#each Array(count) as _, i (i)}
            <div class="tile" aria-hidden="true">
                <figure class="card m-0 overflow-hidden rounded-ui bg-panel"><span class="card-btn shim is-loading relative block w-full bg-raised" style="aspect-ratio: 1 / 1"></span></figure>
                <span class="fname"><Skeleton width={i % 3 ? '70%' : '50%'} height="10px" label="" /></span>
                <div class="desc">
                    <Skeleton width="60%" height="14px" label="" />
                    <Skeleton lines={3} label="" />
                </div>
                <span class="cols">{#each Array(3) as _c, j (j)}<span><Skeleton width="80%" height="10px" label="" /></span>{/each}</span>
            </div>
        {/each}
    </div>
</div>

<style>
    /* clip to the pane: a placeholder never adds a scrollbar */
    .skel { height: 100%; overflow: hidden; }
    .skel :global(.desc) { gap: var(--space-2) !important; padding-top: 2px; }
    .skel :global(.fname) { display: flex !important; align-items: center; height: 16px; }
</style>
