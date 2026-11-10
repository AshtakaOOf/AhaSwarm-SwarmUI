<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Modal from './Modal.svelte';

  type Props = Omit<ComponentProps<typeof Modal>, 'sheet' | 'side' | 'size'> & { side?: 'left' | 'right' };
  let { open = $bindable(false), side = 'right', ...rest }: Props = $props();
</script>

<Modal bind:open sheet={false} {side} {...rest} />
