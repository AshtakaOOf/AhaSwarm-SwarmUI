<script lang="ts">
  import type { Snippet } from 'svelte';
  import ImageIcon from '@lucide/svelte/icons/image';
  import ProgressBar from './ProgressBar.svelte';

  type Props = {
    title: string;
    meta?: string;
    thumb?: string;
    thumbAlt?: string;
    progress?: number | null;
    selected?: boolean;
    tooltip?: string;
    onclick?: (e: MouseEvent) => void;
    leading?: Snippet;
    actions?: Snippet;
    children?: Snippet;
  };
  let { title, meta, thumb, thumbAlt = '', progress, selected = false, tooltip, onclick, leading, actions, children }: Props = $props();
  let loaded = $state(false);
  let failed = $state(false);
  $effect(() => {
    void thumb;
    loaded = failed = false;
  });
</script>

<div class="relative isolate flex min-h-8 items-center gap-3 rounded-ui px-2 py-1 text-ui {selected ? 'bg-active' : onclick ? 'bg-panel hover:bg-hover' : 'bg-panel'}">
  {#if onclick}<button type="button" class="card-btn absolute inset-0 cursor-pointer rounded-ui focus-visible:shadow-[inset_0_0_0_2px_var(--color-ring)]" aria-label={title} aria-pressed={selected} {onclick}></button>{/if}
  {#if leading}{@render leading()}{:else if thumb !== undefined}
    <span class="shim pointer-events-none relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-raised text-ink-3 {thumb && !failed && !loaded ? 'is-loading' : ''}">
      {#if thumb && !failed}
        <img src={thumb} alt={thumbAlt} loading="lazy" decoding="async" class="absolute inset-0 h-full w-full object-cover transition-opacity duration-150 {loaded ? 'opacity-100' : 'opacity-0'}" onload={() => (loaded = true)} onerror={() => (failed = true)} />
      {:else}<ImageIcon size={15} aria-hidden="true" />{/if}
    </span>
  {/if}
  <span class="pointer-events-none relative flex min-w-0 flex-1 flex-col">
    <span class="truncate leading-[19px] font-medium">{title}</span>
    {#if meta}<span class="truncate text-small leading-[17px] text-ink-2">{meta}</span>{/if}
    {@render children?.()}
    {#if progress !== undefined}<ProgressBar value={progress} ariaLabel="{title} progress" />{/if}
  </span>
  {#if actions}<span class="relative z-10 flex shrink-0 gap-1">{@render actions()}</span>{/if}
</div>
