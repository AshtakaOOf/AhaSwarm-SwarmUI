<script lang="ts">
  // chip that copies its value: clipboard icon, the value (ellipsized), a check for a moment after copying
  import Check from '@lucide/svelte/icons/check';
  import Clipboard from '@lucide/svelte/icons/clipboard';
  import { copyText } from './util';

  type Props = { value: string; label?: string; class?: string; oncopy?: (value: string) => void };
  let { value, label, class: cls = '', oncopy }: Props = $props();
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout>;
  async function copy(e: MouseEvent) {
    e.stopPropagation();
    if (!(await copyText(value))) return;
    copied = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 1600);
    oncopy?.(value);
  }
</script>

<button type="button" class="chip ui-copy-chip {cls}" aria-label={label ?? `Copy ${value}`} onclick={copy}>
  <Clipboard size={12} class="shrink-0" aria-hidden="true" />
  <span class="val">{value}</span>
  {#if copied}<Check size={12} class="shrink-0" aria-hidden="true" />{/if}
</button>

<style>
  .ui-copy-chip { max-width: 100%; min-width: 0; background: var(--color-hover); }
  .ui-copy-chip:hover, .ui-copy-chip:focus-visible { background: var(--color-active); color: var(--color-ink); }
  .val { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
