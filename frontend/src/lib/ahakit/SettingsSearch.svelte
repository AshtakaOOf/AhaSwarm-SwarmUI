<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import TextInput from './TextInput.svelte';
  import type { SearchScope } from './search.svelte';

  let { value = $bindable(''), scope, count, placeholder = 'Search settings…', label = 'Search settings', class: cls = '' }:
    { value?: string; scope?: SearchScope; count?: number; placeholder?: string; label?: string; class?: string } = $props();
  const q = $derived(scope ? scope.query : value);
  const n = $derived(count ?? scope?.count);
  function set(v: string) { if (scope) scope.query = v; else value = v; }
</script>

<div class="ui-settings-search {cls}" role="search">
  <Search size={14} class="ico" aria-hidden="true" />
  <TextInput type="search" {placeholder} aria-label={label} value={q} oninput={set} />
  {#if q.trim() && n !== undefined}<span class="n tabular-nums" aria-live="polite">{n} match{n === 1 ? '' : 'es'}</span>{/if}
</div>

<style>
  .ui-settings-search { position: relative; display: flex; align-items: center; gap: var(--space-2); }
  .ui-settings-search :global(.ico) { position: absolute; left: 9px; color: var(--color-ink-3); pointer-events: none; z-index: 1; }
  .ui-settings-search :global(input) { padding-left: 28px; }
  .ui-settings-search > :global(*:nth-child(2)) { flex: 1; min-width: 0; }
  .n { flex: none; font-size: 12px; color: var(--color-ink-3); }
</style>
