<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  export type StatItem = { icon?: LucideIcon; label: string; value: string | number | null | undefined };
  let { items, label, variant = 'row' }: { items: StatItem[]; label?: string; variant?: 'row' | 'tiles' } = $props();
</script>

<div class="aha-stats" class:aha-tiles={variant === 'tiles'} role="list" aria-label={label}>
  {#each items as s (s.label)}
    <span class="aha-stat" class:zero={!s.value} role="listitem">{#if s.icon}{@const I = s.icon}<I size={14} aria-hidden="true" />{/if}<span class="k">{s.label}</span><span class="v">{s.value ?? 0}</span></span>
  {/each}
</div>
