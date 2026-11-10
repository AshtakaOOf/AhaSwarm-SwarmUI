<script lang="ts">
  import type { KeyValue } from './types';
  import CopyChip from './CopyChip.svelte';

  let { items, dense = false, inline = false, label }: { items: KeyValue[] | Record<string, KeyValue['value']>; dense?: boolean; inline?: boolean; label?: string } = $props();
  const rows = $derived(Array.isArray(items) ? items : Object.entries(items).map(([key, value]) => ({ key, value }) as KeyValue));
</script>

<div class="ui-kv-wrap"><dl class="ui-kv" class:dense class:inline aria-label={label}>
  {#each rows as r (r.key)}
    <dt>{r.key}</dt>
    <dd class:mono={r.mono}>
      {#if r.chips?.length}
        <span class="chips">{#each r.chips as chip, i (i)}<CopyChip value={chip} />{/each}</span>
      {:else if r.copy && r.value != null}
        <CopyChip value={`${r.value}`} />
      {:else}
        {r.value ?? '-'}
      {/if}
    </dd>
  {/each}
</dl></div>

<style>
  .ui-kv {
    display: grid;
    grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
    gap: var(--space-1) var(--space-4);
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    line-height: var(--line-height);
  }
  .dense {
    gap: 0 var(--space-3);
    font-size: var(--font-size-label);
  }
  .ui-kv-wrap {
    container-type: inline-size;
    min-width: 0;
  }
  dt {
    max-width: 18ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
  }
  @container (max-width: 220px) {
    .ui-kv:not(.inline) {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }
    .ui-kv:not(.inline) dt {
      max-width: none;
      font-size: var(--font-size-xs);
    }
    .ui-kv:not(.inline) dd + dt {
      margin-top: var(--space-1);
    }
  }
  .inline dd {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    overflow-wrap: normal;
  }
  dd {
    margin: 0;
    min-width: 0;
    color: var(--color-text);
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: var(--font-size-label);
  }
  .chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
</style>
