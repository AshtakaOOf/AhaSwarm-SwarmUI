<script lang="ts">
    import { Skeleton } from '../ui';

    const GROUPS = [4, 3, 2];
</script>

<div class="skel" role="status" aria-label="Loading parameters" aria-busy="true">
    {#each GROUPS as rows, g (g)}
        <div class="group" aria-hidden="true">
            <Skeleton width="{40 - g * 6}%" height="10px" label="" />
            {#each Array(rows) as _, r (r)}
                <div class="row">
                    <Skeleton width="{30 + ((g + r) % 3) * 8}%" height="10px" label="" />
                    <Skeleton height="var(--size-control)" label="" />
                </div>
            {/each}
        </div>
    {/each}
</div>

<style>
    .skel { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-2) 0; }
    .group { display: flex; flex-direction: column; gap: var(--space-3); }
    .row { display: flex; flex-direction: column; gap: var(--space-1); }
</style>
