<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Toggle from './Toggle.svelte';
  import { uid } from './util';

  type Props = {
    title: string;
    /** optional Lucide icon after the chevron */
    icon?: import('@lucide/svelte').LucideIcon;
    description?: string;
    open?: boolean;
    toggleable?: boolean;
    enabled?: boolean;
    id?: string;
    ontoggle?: (open: boolean) => void;
    onenable?: (enabled: boolean) => void;
    actions?: Snippet;
    headClass?: string;
    children: Snippet;
  };
  let { title, icon, description, open = $bindable(true), toggleable = false, enabled = $bindable(true), id = uid('pg'), ontoggle, onenable, actions, headClass = '', children }: Props = $props();
  const cut = $derived(title.indexOf(': '));
  const name = $derived(cut < 0 ? title : title.slice(0, cut));
  const rest = $derived(cut < 0 ? '' : title.slice(cut));
</script>

<section class="ui-group" class:off={toggleable && !enabled} aria-labelledby="{id}-h">
  <h3 class="mt-3 mb-0 flex items-center gap-2 text-small font-normal text-ink-3 {headClass}">
    <button
      type="button"
      class="head flex min-w-0 flex-1 items-center gap-1 rounded-ui text-left hover:text-ink active:text-ink"
      id="{id}-h"
      aria-expanded={open}
      aria-controls="{id}-b"
      onclick={() => ((open = !open), ontoggle?.(open))}
    >
      <ChevronDown size={15} class="chev shrink-0 {open ? '' : '-rotate-90'}" aria-hidden="true" />
      {#if icon}{@const I = icon}<I size={14} class="shrink-0" aria-hidden="true" />{/if}
      <span class="truncate"><span class="uppercase">{name}</span>{rest}</span>
    </button>
    {#if actions}{@render actions()}{/if}
    {#if toggleable}<Toggle bind:checked={enabled} size="sm" label="Enable {title}" hideLabel onchange={onenable} />{/if}
  </h3>
  <div class="body" class:open id="{id}-b">
    <div class="inner"><div class="flex flex-col gap-1 {toggleable && !enabled ? 'opacity-45' : ''}">{@render children()}</div></div>
  </div>
</section>

<style>
  .ui-group:first-child > h3 {
    margin-top: 0;
  }
  .head {
    height: var(--size-control);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: color var(--motion-fast);
  }
  .head :global(.chev) {
    transition: rotate var(--motion-fast), translate var(--motion-fast), transform var(--motion-fast);
  }
  .body {
    display: grid;
    grid-template-rows: 0fr;
    visibility: hidden;
    transition: grid-template-rows var(--motion-base), visibility var(--motion-base);
  }
  .body.open {
    grid-template-rows: 1fr;
    visibility: visible;
  }
  .inner {
    min-height: 0;
    overflow: hidden;
  }
  @supports (overflow-clip-margin: 6px) {
    .body.open > .inner {
      overflow: clip;
      overflow-clip-margin: 6px;
    }
  }
</style>
