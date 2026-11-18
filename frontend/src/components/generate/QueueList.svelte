<script lang="ts">
    import { gen, type Job } from '../../lib/state/gen.svelte';
    import { batchSettings } from '../../lib/state/batch.svelte';
    import { QueueItem } from '../ui';

    let { empty = '' }: { empty?: string } = $props();

    function jobProgress(g: Job[]): number | null {
        const slots = g.flatMap(j => Object.values(j.slots));
        if (!slots.length) return null;
        const total = g.reduce((a, j) => a + Math.max(j.images, Object.keys(j.slots).length), 0);
        return slots.reduce((a, s) => a + (s.done ? 1 : s.overall), 0) / Math.max(total, 1);
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
        const slots = g.flatMap(j => Object.values(j.slots));
        const total = slots.length || g.reduce((a, j) => a + j.images, 0);
        const done = slots.filter(s => s.done).length;
        const active = slots.filter(s => !s.done);
        const parts: string[] = [];
        if (g.length > 1) {
            parts.push(`${g.length} generations (seeds differ)`);
        }
        parts.push(`${done}/${total} images`, `step ${Math.round((active.reduce((a, s) => a + s.current, 0) / (active.length || 1)) * 100)}%`);
        return parts.join(' · ');
    };
</script>

{#if groups.length || failed.length}
    <div class="queue" role="list" aria-label="Generation queue">
        {#each groups as g (g[0].id)}
            <div role="listitem"><QueueItem title={(g.length > 1 ? `${g.length}× ` : '') + (g[0].prompt || '(empty prompt)')} meta={meta(g)} status="running"
                progress={jobProgress(g)} dot={false} oncancel={() => gen.interrupt()} /></div>
        {/each}
        {#each failed as j (j.id)}
            <div role="listitem"><QueueItem title={j.prompt || '(empty prompt)'} meta={`Failed${j.error ? ` · ${j.error}` : ''}`} status="error" /></div>
        {/each}
    </div>
{:else if empty}
    <p class="hint">{empty}</p>
{/if}

<style>
    .queue { display: flex; flex-direction: column; gap: var(--space-1); }
    .hint { margin: 0; padding: var(--space-2) 10px; font-size: var(--text-small, 12px); color: var(--color-ink-3); }
</style>
