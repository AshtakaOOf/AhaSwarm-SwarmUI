<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Modal from './Modal.svelte';

  let { open = $bindable(false), ...rest }: Omit<ComponentProps<typeof Modal>, 'sheet'> = $props();
</script>

<Modal bind:open sheet {...rest} />
