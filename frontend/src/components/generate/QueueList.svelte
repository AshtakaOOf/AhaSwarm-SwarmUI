<script lang="ts">
    import { gen, type Job } from '../../lib/state/gen.svelte';
    import { batchSettings } from '../../lib/state/batch.svelte';
    import { QueueItem } from '../ui';

    let { empty = '' }: { empty?: string } = $props();

    function jobProgress(j: Job): number | null {
        const slots = Object.values(j.slots);
        return slots.length ? slots.reduce((a, s) => a + (s.done ? 1 : s.overall), 0) / Math.max(j.images, slots.length) : null;
    }
    const groups = $derived.by(() => {
        const out: Job[][] = [];
        const byKey = new Map<string, Job[]>();
        for (const j of [...gen.running].reverse()) {
            const g = j.key ? byKey.get(j.key) : undefined;
            if (g) g.push(j);
            else { const n = [j]; out.push(n); if (j.key) byKey.set(j.key, n); }
        }
        return out;
    });
    const failed = $derived(batchSettings.values.showSpinners ? gen.jobs.filter(j => j.state === 'error').slice(0, 3) : []);
    const meta = (g: Job[]) => {
        const imgs = g.reduce((a, j) => a + j.images, 0);
        return g.length > 1 ? `${g.length} generations (seeds differ) - ${imgs} images` : `${imgs}× - generating`;
    };
</script>

{#if groups.length || failed.length}
    <div class="queue" role="list" aria-label="Generation queue">
        {#each groups as g (g[0].id)}
            <div role="listitem"><QueueItem title={(g.length > 1 ? `${g.length}× ` : '') + (g[0].prompt || '(empty prompt)')} meta={meta(g)} status="running"
                progress={jobProgress(g[0])} dot={false} oncancel={() => gen.interrupt()} /></div>
        {/each}
        {#each failed as j (j.id)}
            <div role="listitem"><QueueItem title={j.prompt || '(empty prompt)'} meta={j.error ?? 'failed'} status="error" /></div>
        {/each}
    </div>
{:else if empty}
    <p class="hint">{empty}</p>
{/if}

<style>
    .queue { display: flex; flex-direction: column; gap: var(--space-1); }
    .hint { margin: 0; padding: var(--space-2) 10px; font-size: var(--text-small, 12px); color: var(--color-ink-3); }
</style>
