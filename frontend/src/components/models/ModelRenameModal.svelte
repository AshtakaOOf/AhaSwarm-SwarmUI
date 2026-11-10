<script lang="ts">
    import { untrack } from 'svelte';
    import { api } from '../../lib/api/swarm';
    import type { ModelInfo } from '../../lib/api/types';
    import { ui } from '../../lib/state/ui.svelte';
    import { Button, Dropdown, FormRow, Modal, TextInput } from '../ui';

    type Props = { model: ModelInfo; subtype: string; folders: string[]; onrenamed: () => void; onclose: () => void };
    let { model, subtype, folders, onrenamed, onclose }: Props = $props();
    const NONE = '(None)';
    const oldName = untrack(() => model.name);
    const slash = oldName.lastIndexOf('/');
    let open = $state(true);
    let folder = $state(slash !== -1 ? oldName.substring(0, slash) : NONE);
    let name = $state(oldName.substring(slash + 1));
    let busy = $state(false);
    const folderOptions = $derived([NONE, ...folders].map(f => ({ value: f, label: f })));
    const cleanName = $derived(name.trim().split('/').map(p => p.trim()).filter(Boolean).join('/'));
    const newName = $derived(folder === NONE ? cleanName : `${folder}/${cleanName}`);
    const valid = $derived(!!cleanName && newName !== model.name);

    async function rename() {
        if (!valid || busy) return;
        busy = true;
        try {
            await api.renameModel(model.name, newName, subtype);
            ui.toast(`Renamed to ${newName}.`, 'success');
            open = false;
            onrenamed();
        }
        catch (e) {
            ui.error(e);
        }
        busy = false;
    }
</script>

<Modal bind:open tone="panel" title="Rename model" subtitle={model.name} size="md" {onclose}>
    <form class="ui-dense rename" onsubmit={(e) => { e.preventDefault(); rename(); }}>
        <FormRow label="Folder"><Dropdown ariaLabel="Folder" options={folderOptions} bind:value={folder} searchable /></FormRow>
        <FormRow label="File name"><TextInput bind:value={() => name, (v: string) => (name = v.replace(/ /g, '_').replace(/\\/g, '/'))} aria-label="File name" hint="Use / to create new folders, e.g. styles/my_model" /></FormRow>
        {#if cleanName}<p class="aha-muted path">New path: <code>{newName}</code></p>{/if}
    </form>
    {#snippet footer()}
        <Button onclick={() => { open = false; onclose(); }}>Cancel</Button>
        <Button variant="primary" disabled={!valid || busy} onclick={rename}>Rename</Button>
    {/snippet}
</Modal>

<style>
    .rename { display: flex; flex-direction: column; gap: var(--space-1); }
    .rename :global(.aha-frow > .lbl) { flex-basis: 90px; }
    .path { margin: 0; font-size: var(--text-small); overflow-wrap: anywhere; }
</style>
