<script lang="ts">
  import GitCommit from '@lucide/svelte/icons/git-commit-horizontal';
  let { lines, label = 'Commits' }: { lines: string[]; label?: string } = $props();
  const parsed = $derived(lines.map((l) => {
    if (l.trim() === '...') return { gap: true, date: '', text: '' };
    const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?): (.*)$/.exec(l);
    return { gap: false, date: m ? m[1].slice(0, 16) : '', text: m ? m[2] : l };
  }));
</script>

<ol class="ui-commits" aria-label={label}>
  {#each parsed as c, i (i)}
    {#if c.gap}<li class="gap" aria-label="More commits">⋯</li>
    {:else}<li><GitCommit size={14} class="ico" aria-hidden="true" /><span class="t" title={c.text}>{c.text}</span>{#if c.date}<time class="d">{c.date}</time>{/if}</li>{/if}
  {/each}
</ol>

<style>
  .ui-commits { list-style: none; margin: 0; padding: 0 0 0 2px; display: flex; flex-direction: column; font-size: var(--text-small, 12px); border-left: 1px solid var(--color-control-border, var(--color-active)); margin-left: 6px; }
  .ui-commits li { display: flex; align-items: center; gap: var(--space-2); min-height: 22px; padding-left: 4px; position: relative; }
  .ui-commits li :global(.ico) { flex: none; margin-left: -14px; color: var(--color-accent); background: var(--param-section-bg, var(--color-panel)); }
  .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-ink); }
  .d { flex: none; color: var(--color-ink-3); font-variant-numeric: tabular-nums; }
  .gap { color: var(--color-ink-3); padding-left: 8px; min-height: 16px; }
</style>
