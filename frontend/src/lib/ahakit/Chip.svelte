<script lang="ts">
  import type { Snippet } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import NumberInput from './NumberInput.svelte';

  type Props = {
    label: string;
    title?: string;
    variant?: 'default' | 'active' | 'include' | 'exclude' | 'danger';
    weight?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    size?: 'md' | 'lg';
    maxChars?: number;
    removeLabel?: string;
    onclick?: (e: MouseEvent) => void;
    onremove?: () => void;
    onweightchange?: (weight: number) => void;
    children?: Snippet;
    /** compact control rendered before the label (e.g. a LoRA mode selector) */
    prefix?: Snippet;
    /** flush thumbnail inside the label, part of its click target */
    media?: Snippet;
    extra?: Snippet;
  };
  let { label, title, variant = 'default', weight = $bindable(), min = -10, max = 10, step = 0.05, disabled = false, size = 'md', maxChars, removeLabel, onclick, onremove, onweightchange, children, prefix, media, extra }: Props = $props();
  const tone = $derived(variant === 'include' ? 'tag-inc' : variant === 'exclude' || variant === 'danger' ? 'tag-exc' : variant === 'active' ? 'bg-active text-ink' : '');
</script>

<span class="chip {size === 'lg' ? 'h-9' : 'h-8'} max-w-full shrink-0 gap-0 p-0 text-small {tone} {disabled ? 'opacity-45' : ''}" {title}>
  {@render prefix?.()}
  {#if onclick}
    <button type="button" class="chip-label inline-flex h-full min-w-0 items-center gap-1 truncate {prefix ? '' : 'rounded-l-ui'} {media ? 'overflow-hidden pl-0' : 'pl-2'} pr-1.5 hover:bg-[var(--color-press)] {variant === 'exclude' ? 'line-through' : ''}" {disabled} {onclick}>{@render media?.()}<span class="truncate" style:max-width={maxChars ? `${maxChars}ch` : undefined}>{label}</span>{@render children?.()}</button>
  {:else}
    <span class="chip-label inline-flex h-full min-w-0 items-center gap-1 truncate pr-1.5 {media ? 'pl-0' : 'pl-2'} {variant === 'exclude' ? 'line-through' : ''}">{@render media?.()}<span class="truncate" style:max-width={maxChars ? `${maxChars}ch` : undefined}>{label}</span>{@render children?.()}</span>
  {/if}
  {#if weight !== undefined}
    <NumberInput bind:value={weight} {min} {max} {step} {disabled} wheel size="xs" ariaLabel="{label} weight" onchange={onweightchange} />
  {/if}
  {@render extra?.()}
  {#if onremove}
    <button type="button" class="inline-flex items-center self-stretch rounded-r-ui px-1.5 opacity-70 hover:bg-[var(--color-press)] hover:opacity-100" {disabled} aria-label={removeLabel ?? `Remove ${label}`} title={removeLabel ?? `Remove ${label}`} onclick={onremove}><X size={15} aria-hidden="true" /></button>
  {/if}
</span>
