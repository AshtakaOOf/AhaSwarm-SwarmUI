<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tone } from './types';

  let { label, tone = 'neutral', title, children }: { label?: string; tone?: Tone; title?: string; children?: Snippet } = $props();
</script>

<span class="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 text-small leading-[16px] font-semibold whitespace-nowrap tabular-nums {tone === 'success' ? 'tag-inc' : tone === 'danger' ? 'age-r' : tone === 'warning' ? 'age-o' : tone === 'info' ? 'bg-[var(--color-info-bg)] text-[var(--color-info-fg)]' : 'bg-hover text-ink-2'}" {title}>{#if children}{@render children()}{:else}{label}{/if}</span>

