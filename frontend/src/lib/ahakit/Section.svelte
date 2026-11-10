<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LucideIcon } from '@lucide/svelte';
  type Props = { title: string; icon?: LucideIcon; plain?: boolean; dense?: boolean; class?: string; lead?: Snippet; actions?: Snippet; children?: Snippet };
  let { title, icon, plain = false, dense = false, class: cls = '', lead, actions, children }: Props = $props();
</script>

<section class="aha-sec {cls}" class:ui-dense={dense}>
  <h3 class="aha-sec-h">{#if lead}{@render lead()}{:else if icon}{@const I = icon}<I size={14} aria-hidden="true" />{/if}<span class="t" class:plain>{title}</span>{#if actions}{@render actions()}{/if}</h3>
  {@render children?.()}
</section>

<style>
  .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t.plain { text-transform: none; color: var(--color-ink); }
</style>
