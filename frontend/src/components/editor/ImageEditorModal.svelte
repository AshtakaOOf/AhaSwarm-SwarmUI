<script lang="ts">
    import { editorState } from '../../lib/state/editor.svelte';
    import { Modal } from '../ui';
    import type ImageEditorType from './ImageEditor.svelte';

    let ImageEditor = $state<typeof ImageEditorType | null>(null);

    $effect(() => {
        if (editorState.visible && !ImageEditor) {
            import('./ImageEditor.svelte').then(m => { ImageEditor = m.default; });
        }
    });
</script>

{#if editorState.editor && editorState.visible}
    <Modal open sheet={false} dismissable={false} size="xl" tone="clear" fullscreen="auto">
        {#if ImageEditor}
            <ImageEditor editor={editorState.editor} />
        {/if}
    </Modal>
{/if}
