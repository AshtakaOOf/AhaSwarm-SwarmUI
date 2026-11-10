<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useSearch, useSearchGroup } from './search.svelte';
  import { uid } from './util';

  let { text, children }: { text: string; children: Snippet } = $props();
  const id = uid('si');
  const scope = useSearch();
  const group = useSearchGroup();
  $effect(() => scope?.register(id, text, group));
</script>

{#if !scope || scope.shows(text, group)}{@render children()}{/if}
