<script lang="ts">
  import type { Snippet } from 'svelte';
  import { provideSearchGroup, useSearch } from './search.svelte';
  import { uid } from './util';

  let { title, children }: { title: string; children: Snippet<[boolean]> } = $props();
  const id = uid('sg');
  const scope = useSearch();
  provideSearchGroup(id);
  $effect(() => scope?.registerGroup(id, title));
</script>

{#if !scope || scope.groupShows(id)}{@render children(!!scope?.active)}{/if}
