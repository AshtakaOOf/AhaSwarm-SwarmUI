<script lang="ts">
    import { untrack } from 'svelte';
    import LImage from '@lucide/svelte/icons/image';
    import { api } from '../../lib/api/swarm';
    import { resolveUrl } from '../../lib/api/client';
    import { gen } from '../../lib/state/gen.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { fileToDataUrl } from '../../lib/util/metadata';
    import { imageToData } from '../../lib/util/civitai';
    import { Button, FormRow, ImageInput, Modal, Textarea, TextInput } from '../ui';

    let { card, onclose, onsaved }: {
        card: { name: string; raw: string; image?: string };
        onclose: () => void;
        onsaved: () => void | Promise<void>;
    } = $props();

    let open = $state(true);
    const original = untrack(() => (card.name.endsWith('/') ? '' : card.name));
    let name = $state(untrack(() => card.name));
    let raw = $state(untrack(() => card.raw));
    let img = $state('');
    // keep = don't send an image; set = data URL; clear = remove
    let imageMode = $state<'keep' | 'set' | 'clear'>('keep');
    let imageData = $state('');
    let testResult = $state('');

    const showable = (src: string | undefined) => !!src && !src.includes('model_placeholder.jpg');

    $effect(() => {
        let cancel = false;
        const start = untrack(() => card);
        if (showable(start.image)) {
            img = start.image!.startsWith('data:') ? start.image! : resolveUrl(start.image);
        }
        if (!original) {
            return;
        }
        api.describeModel(original, 'Wildcards').then((res: { model?: { raw?: string; image?: string }; raw?: string; image?: string }) => {
            if (cancel) {
                return;
            }
            const full = res.model ?? res;
            raw = full.raw ?? raw;
            if (imageMode === 'keep' && showable(full.image)) {
                img = full.image!.startsWith('data:') ? full.image! : resolveUrl(full.image);
            }
        }).catch(() => { });
        return () => { cancel = true; };
    });

    function cleanName(): string {
        return name.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    }

    async function useCurrent() {
        const src = gen.current?.src;
        if (!src) {
            return;
        }
        const data = await imageToData(src.startsWith('data:') ? src : resolveUrl(src));
        if (!data) {
            throw new Error('Could not read the current image.');
        }
        img = data;
        imageData = data;
        imageMode = 'set';
    }

    async function onfiles(files: File[]) {
        try {
            const data = await imageToData(await fileToDataUrl(files[0]));
            if (!data) {
                throw new Error('Could not read that image.');
            }
            img = data;
            imageData = data;
            imageMode = 'set';
        }
        catch (e) {
            ui.error(e);
        }
    }

    async function test() {
        const cardName = cleanName();
        if (!cardName || cardName.endsWith('/')) {
            throw new Error('Enter a wildcard name first.');
        }
        testResult = (await api.testPromptFill(`<wildcard:${cardName}>`)).result ?? '';
    }

    async function save() {
        const cardName = cleanName();
        if (!cardName) {
            throw new Error('Name is required.');
        }
        if (cardName.endsWith('/')) {
            throw new Error('Give the wildcard a file name, or remove the trailing slash.');
        }
        const content = raw.replace(/\s+$/, '');
        if (!content) {
            throw new Error('At least one entry is required.');
        }
        const options = content.endsWith('\n') ? content : `${content}\n`;
        await api.editWildcard(cardName, options, imageMode === 'keep' ? undefined : imageMode === 'clear' ? 'clear' : imageData);
        if (original && original !== cardName) {
            await api.deleteWildcard(original); // classic: rename saves the new file, then deletes the old one
        }
        open = false;
        await onsaved();
    }

    function close() {
        open = false;
        onclose();
    }
</script>

<Modal bind:open tone="panel" title={original ? 'Edit wildcard' : 'New wildcard'} size="lg" onclose={close}>
    <div class="edit-form ui-dense">
        <FormRow label="Name"><TextInput bind:value={name} aria-label="Wildcard name" placeholder="folder/name" /></FormRow>
        <FormRow label="Options">
            <Textarea bind:value={raw} mono rows={12} autosize={false} aria-label="Wildcard options" placeholder="One option per line. Lines starting with # are comments." />
        </FormRow>
        {#if testResult}<p class="aha-muted result">{testResult}</p>{/if}
        <FormRow label="Preview">
            <div class="preview">
                <ImageInput src={img} label="Preview image" onfiles={onfiles} onclear={() => { img = ''; imageData = ''; imageMode = 'clear'; }} />
                {#if gen.current}<Button icon={LImage} onclick={useCurrent}>Use current image</Button>{/if}
            </div>
        </FormRow>
    </div>
    {#snippet footer()}
        <span class="test"><Button onclick={test}>Test</Button></span>
        <Button onclick={close}>Cancel</Button>
        <Button variant="primary" onclick={save}>Save</Button>
    {/snippet}
</Modal>

<style>
    .edit-form { display: flex; flex-direction: column; gap: var(--space-1); }
    .edit-form :global(.aha-frow > .lbl) { flex-basis: 150px; white-space: nowrap; }
    .edit-form :global(.aha-frow:has(textarea)) { margin-top: 2px; align-items: flex-start; min-height: 0; }
    .edit-form :global(.aha-frow:has(textarea) > .lbl) { padding-top: 6px; }
    .edit-form :global(textarea) { height: min(320px, 50vh); min-height: 0; max-height: min(320px, 50vh); overflow-y: auto; overscroll-behavior: contain; resize: none; }
    .edit-form :global(.aha-frow > .ctl), .edit-form :global(.aha-frow > .ui-ta), .edit-form :global(.aha-frow .ui-ta) { background: var(--color-input); color: var(--color-ink); }
    .edit-form :global(.aha-frow > .ctl:hover:not(:active)), .edit-form :global(.aha-frow > .ctl:focus:not(:active)), .edit-form :global(.aha-frow .ui-ta:hover), .edit-form :global(.aha-frow .ui-ta:focus) { background: var(--color-input-hover); }
    .preview { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .preview :global(.image-input) { flex: none; }
    .result { white-space: pre-wrap; overflow-wrap: anywhere; }
    .test { margin-right: auto; }
</style>
