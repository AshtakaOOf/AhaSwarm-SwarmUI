<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  import ButtonGroup from './ButtonGroup.svelte';
  import Button from './Button.svelte';
  type Opt = { value: string; label: string; icon?: LucideIcon };
  let { options, value = $bindable(), label, onchange }: { options: Opt[]; value?: string; label?: string; onchange?: (v: string) => void } = $props();
</script>

<ButtonGroup {label}>
  {#each options as o (o.value)}<Button icon={o.icon} aria-pressed={o.value === value} onclick={() => { if (o.value !== value) { value = o.value; onchange?.(o.value); } }}>{o.label}</Button>{/each}
</ButtonGroup>
