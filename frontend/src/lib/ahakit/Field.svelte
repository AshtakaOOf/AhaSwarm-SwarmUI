<script lang="ts">
  import type { Snippet } from 'svelte';
  import InfoButton from './InfoButton.svelte';
  type Props = {
    label?: string;
    info?: string;
    hint?: string;
    title?: string | null;
    forId?: string | null;
    scrub?: (e: PointerEvent) => void;
    onreset?: () => void;
    children: Snippet;
  };
  let { label, info, hint, title, forId, scrub, onreset, children }: Props = $props();
</script>

{#if label || hint}
  <div class="flex min-w-0 flex-col gap-0.5">
    {#if label && info}
      <span class="flex items-center gap-1 self-start">
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <label for={forId} {title} class="text-small leading-[17px] text-ink-2 select-none {scrub ? 'cursor-ew-resize touch-none hover:text-ink' : ''}" onpointerdown={scrub} ondblclick={onreset}>{label}</label>
        <InfoButton {label} text={info} />
      </span>
    {:else if label}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <label for={forId} {title} class="self-start text-small leading-[17px] text-ink-2 select-none {title ? 'cursor-help' : ''} {scrub ? 'cursor-ew-resize touch-none hover:text-ink' : ''}" onpointerdown={scrub} ondblclick={onreset}>{label}</label>
    {/if}
    {@render children()}
    {#if hint}<small class="text-small text-ink-3">{hint}</small>{/if}
  </div>
{:else}
  {@render children()}
{/if}

