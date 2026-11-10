<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LucideIcon } from '@lucide/svelte';
  import InfoButton from './InfoButton.svelte';
  let { label, icon, info, children }: { label: string; icon?: LucideIcon; info?: string; children: Snippet } = $props();
</script>

<div class="aha-frow"><span class="lbl">{#if icon}{@const I = icon}<I size={13} aria-hidden="true" />{/if}{label}{#if info}<InfoButton {label} text={info} />{/if}</span>{@render children()}</div>
