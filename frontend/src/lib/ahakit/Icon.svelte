<script lang="ts" module>
  export type { LucideIcon } from '@lucide/svelte';
</script>

<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  let { icon, title, class: cls = '', strokeWidth = 2, fill = 'none' }: { icon: LucideIcon; title?: string; class?: string; strokeWidth?: number; fill?: string } = $props();
  const I = $derived(icon);
</script>

<I size={15} {strokeWidth} {fill} class="inline-block shrink-0 {cls}" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'} />
