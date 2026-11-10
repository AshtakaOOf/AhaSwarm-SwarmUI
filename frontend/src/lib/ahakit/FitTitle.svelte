<script lang="ts">
  import { breakParts, cleanTitle, fitTitle } from './fitTitle';

  type Props = { text: string; width?: number; lines?: number; sizes?: number[]; clean?: boolean; class?: string };
  let { text, width = 0, lines = 2, sizes, clean = true, class: cls = '' }: Props = $props();

  const name = $derived(clean ? cleanTitle(text) : text);
  const fit = $derived(width > 0 ? fitTitle(name, { width, lines, sizes }) : { text: name, size: 0, cut: false });
  const parts = $derived(breakParts(fit.text));
</script>

<span class="ui-fit-title {cls}" style:font-size={fit.size ? `${fit.size}px` : undefined}
  ><span aria-hidden="true">{#each parts as p, i}{#if i}<wbr />{/if}{p}{/each}</span><span class="sr-only">{text}</span></span>

<style>
  .ui-fit-title { text-wrap: balance; }
</style>
