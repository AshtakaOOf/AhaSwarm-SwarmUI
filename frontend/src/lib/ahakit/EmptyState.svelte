<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LucideIcon } from '@lucide/svelte';
  let { title, message, icon, children }: { title: string; message?: string; icon?: LucideIcon; children?: Snippet } = $props();
</script>

<div class="mx-auto mt-16 flex max-w-[48ch] flex-col items-center px-3 text-center text-ink-2">
  {#if icon}{@const I = icon}<I size={15} class="mb-2 text-ink-3" aria-hidden="true" />{/if}
  <p class="text-body text-ink">{title}</p>
  {#if message}<p class="mt-1 text-ui leading-[19px]">{message}</p>{/if}
  {#if children}<div class="mt-3 flex flex-wrap justify-center gap-2">{@render children()}</div>{/if}
</div>
