<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import type { Crumb } from './types';
  let { items, label = 'Breadcrumb', onnavigate }: { items: Crumb[]; label?: string; onnavigate?: (item: Crumb, index: number) => void } = $props();
</script>

<nav class="min-w-0 text-ui" aria-label={label}>
  <ol class="flex flex-wrap items-center gap-0.5">
    {#each items as c, i (i)}
      <li class="inline-flex min-w-0 items-center gap-0.5">
        {#if i > 0}<ChevronRight size={15} class="shrink-0 text-ink-3" aria-hidden="true" />{/if}
        {#if i === items.length - 1}
          <span class="truncate px-1.5 text-ink" aria-current="page">{c.label}</span>
        {:else if c.href}
          <a class="ctl ctl-ghost px-1.5" href={c.href} onclick={(e) => onnavigate && (e.preventDefault(), onnavigate(c, i))}>{c.label}</a>
        {:else}
          <button type="button" class="ctl ctl-ghost px-1.5" onclick={() => onnavigate?.(c, i)}>{c.label}</button>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
