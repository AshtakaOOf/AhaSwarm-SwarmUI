<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';
  import X from '@lucide/svelte/icons/x';
  import ListRow from './ListRow.svelte';
  import StatusDot from './StatusDot.svelte';
  import type { Status } from './types';

  type Props = {
    title: string;
    meta?: string;
    thumb?: string;
    status?: Status;
    progress?: number | null;
    selected?: boolean;
    onclick?: (e: MouseEvent) => void;
    oncancel?: () => void;
    dot?: boolean;
    actions?: Snippet;
  };
  let { title, meta, thumb, status = 'queued', progress, selected = false, onclick, oncancel, dot = true, actions: actionsProp }: Props = $props();
  const shown = $derived(progress !== undefined ? progress : status === 'running' ? null : undefined);
</script>

<ListRow {title} {meta} {thumb} {selected} {onclick} progress={status === 'running' || status === 'queued' ? shown : undefined}>
  {#snippet actions()}
    {#if dot}<StatusDot {status} />{/if}
    {@render actionsProp?.()}
    {#if oncancel && (status === 'queued' || status === 'running')}<IconButton variant="danger" icon={X} label="Cancel {title}" onclick={oncancel} />{/if}
  {/snippet}
</ListRow>
