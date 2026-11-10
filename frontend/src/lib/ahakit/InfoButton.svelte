<script lang="ts">
  import type { Snippet } from 'svelte';
  import Info from '@lucide/svelte/icons/info';
  import IconButton from './IconButton.svelte';
  import Popover from './Popover.svelte';

  type Props = { label: string; text?: string; title?: string; placement?: 'top' | 'bottom'; open?: boolean; children?: Snippet };
  let { label, text, title = label, placement = 'bottom', open = $bindable(false), children }: Props = $props();
</script>

<Popover bind:open {title} label="{label} info" {placement}>
  {#snippet trigger(p)}<IconButton {...p} icon={Info} label="About {label}" />{/snippet}
  {#if children}{@render children()}{:else if text}{#each text.split('\n').filter(Boolean) as line, i (i)}<p>{line}</p>{/each}{/if}
</Popover>
