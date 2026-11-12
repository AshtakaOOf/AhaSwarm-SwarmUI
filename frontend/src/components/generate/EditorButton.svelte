<script lang="ts">
    import LImage from '@lucide/svelte/icons/image';
    import LX from '@lucide/svelte/icons/x';
    import { editorState } from '../../lib/state/editor.svelte';
    import { Button, ButtonGroup } from '../ui';

    let { icon = false }: { icon?: boolean } = $props();
    const editing = $derived(!!editorState.editor);
    const mark = $derived(icon ? LImage : undefined);
</script>

{#if editing}
    <div class="ed">
        <ButtonGroup label="Image Editor">
            <Button variant="primary" icon={mark} onclick={() => editorState.show()}>Image Editor</Button>
            <Button variant="danger" icon={LX} iconOnly aria-label="Discard the image edit" title="Discard the image edit" onclick={() => editorState.discard()} />
        </ButtonGroup>
    </div>
{:else}
    <Button icon={mark} onclick={() => editorState.show()}>Image Editor</Button>
{/if}

<style>
    .ed { display: inline-flex; }
    .ed :global(.ui-group-btns) { gap: 0; overflow: hidden; border-radius: var(--radius-ui); }
</style>
