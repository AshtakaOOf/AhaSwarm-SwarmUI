<script lang="ts">
  import IconButton from './IconButton.svelte';
  import Check from '@lucide/svelte/icons/check';
  import Copy from '@lucide/svelte/icons/copy';
  import { copyText } from './util';

  let { text, label = 'Copy', size = 'sm' }: { text: string | (() => string); label?: string; size?: 'sm' | 'md' } = $props();
  let done = $state(false);
  let t: ReturnType<typeof setTimeout>;

  async function copy() {
    if (!(await copyText(typeof text === 'function' ? text() : text))) return;
    done = true;
    clearTimeout(t);
    t = setTimeout(() => (done = false), 1600);
  }
</script>

<IconButton icon={done ? Check : Copy} label={done ? 'Copied' : label} {size} onclick={copy} />
