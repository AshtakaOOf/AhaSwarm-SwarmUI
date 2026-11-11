<script lang="ts">
    import { editorState } from '../../lib/state/editor.svelte';
    import { Modal } from '../ui';
    import ImageEditor from './ImageEditor.svelte';
</script>

<!-- not dismissable: Escape and outside clicks belong to the editor (deselect, cancel transform); its close keeps the edit -->
{#if editorState.editor && editorState.visible}
    <Modal open sheet={false} dismissable={false} size="lg" class="editor-modal">
        <ImageEditor editor={editorState.editor} />
    </Modal>
{/if}

<style>
    :global(.editor-modal.lg) { max-width: min(1680px, 100%); width: 100%; height: min(1080px, 100%); overflow: hidden; background: transparent; }
    :global(.editor-modal > .body) { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
    @media (max-width: 760px) {
        :global(.ui-modal:has(> .editor-modal)) { padding: 0; }
        :global(.editor-modal.lg) { height: 100%; border-radius: 0; padding-bottom: env(safe-area-inset-bottom); }
    }
</style>
