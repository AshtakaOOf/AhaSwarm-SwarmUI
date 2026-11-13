<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  type Props = { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; size?: 'sm' | 'md'; onresult: (ok: boolean) => void };
  let { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true, size = 'sm', onresult }: Props = $props();
  let open = $state(true);
</script>

<Modal bind:open {title} {size} sheet={false} onclose={() => onresult(false)}>
  <p class="msg">{message}</p>
  {#snippet footer()}
    <Button icon={X} onclick={() => onresult(false)}>{cancelLabel}</Button>
    <Button variant={danger ? 'danger' : 'primary'} onclick={() => onresult(true)}>{confirmLabel}</Button>
  {/snippet}
</Modal>

<style>
  .msg { margin: 0; white-space: pre-wrap; color: var(--color-ink-2); }
</style>
