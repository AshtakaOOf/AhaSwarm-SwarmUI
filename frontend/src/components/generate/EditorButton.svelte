<script lang="ts">
    import LImage from '@lucide/svelte/icons/image';
    import LX from '@lucide/svelte/icons/x';
    import { editorState } from '../../lib/state/editor.svelte';
    import { Button, ButtonGroup } from '../ui';

    let { icon = false, src, ondone }: { icon?: boolean; src?: string; ondone?: () => void } = $props();
    const editing = $derived(!!editorState.editor);
    const mark = $derived(icon ? LImage : undefined);

    async function go() {
        if (src) {
            if (await editorState.open(src)) ondone?.();
            return;
        }
        editorState.show();
        ondone?.();
    }
</script>

{#if editing}
    <div class="ed">
        <ButtonGroup label="Image Editor">
            <Button variant="primary" icon={mark} onclick={go}>Image Editor</Button>
            <Button variant="danger" icon={LX} iconOnly aria-label="Discard the image edit" title="Discard the image edit" onclick={() => editorState.discard()} />
        </ButtonGroup>
    </div>
{:else}
    <Button icon={mark} onclick={go}>Image Editor</Button>
{/if}

<style>
    .ed { display: inline-flex; }
    .ed :global(.ui-group-btns) { gap: 0; overflow: hidden; border-radius: var(--radius-ui); }
</style>
