<script lang="ts">
    import LStar from '@lucide/svelte/icons/star';
    import LPlus from '@lucide/svelte/icons/plus';
    import LMinus from '@lucide/svelte/icons/minus';
    import LPencil from '@lucide/svelte/icons/pencil';
    import LCopy from '@lucide/svelte/icons/copy';
    import LChevronDown from '@lucide/svelte/icons/chevron-down';
    import LTrash2 from '@lucide/svelte/icons/trash-2';
    import { api } from '../../lib/api/swarm';
    import { hasModelPreview, modelPreviewSrc } from '../../lib/state/models';
    import { gen } from '../../lib/state/gen.svelte';
    import { Button, GalleryCard, Icon, Menu, Modal, type MenuItem } from '../ui';

    let { name, raw = '', image, starred, active, canEdit, onuse, onstar, onedit, onduplicate, ondelete, onclose }: {
        name: string;
        raw?: string;
        image?: string;
        starred: boolean;
        active: boolean;
        canEdit: boolean;
        onuse: () => void;
        onstar: () => void;
        onedit: () => void;
        onduplicate: () => void;
        ondelete: () => void;
        onclose: () => void;
    } = $props();

    let open = $state(true);
    let text = $state('');
    let pic = $state('');
    const file = $derived(name.split('/').pop() ?? name);
    const folder = $derived(name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '');
    const shownImage = $derived(pic || image || '');
    const preview = $derived(modelPreviewSrc(shownImage));
    const chunks = $derived.by(() => {
        const lines = text.split('\n');
        const out: string[] = [];
        for (let i = 0; i < lines.length; i += 40) {
            const block = lines.slice(i, i + 40).join('\n');
            if (block.trim()) {
                out.push(block);
            }
        }
        return out;
    });

    $effect(() => {
        text = raw;
        pic = image ?? '';
        let cancel = false;
        api.describeModel(name, 'Wildcards').then((res: { model?: { raw?: string; image?: string }; raw?: string; image?: string }) => {
            if (cancel) {
                return;
            }
            const full = res.model ?? res;
            if (full.raw != null) {
                text = full.raw;
            }
            if (full.image) {
                pic = full.image;
            }
        }).catch(() => { });
        return () => { cancel = true; };
    });

    function showPreview() {
        if (!hasModelPreview(shownImage)) {
            return;
        }
        gen.setCurrent(shownImage, null, 'wildcard');
        open = false;
        onclose();
    }

    const more = $derived<MenuItem[]>(canEdit ? [
        { label: 'Duplicate', icon: LCopy, onselect: onduplicate },
        { label: 'Delete', icon: LTrash2, danger: true, onselect: ondelete },
    ] : []);
</script>

<Modal bind:open tone="panel" title={file} subtitle={folder || undefined} size="lg" onclose={onclose}>
    <div class="mi">
        <div class="pv">
            <GalleryCard src={preview} placeholder="No preview" alt={hasModelPreview(shownImage) ? `Set ${file} as current image` : file} aspect="auto" fit="contain"
                onclick={hasModelPreview(shownImage) ? showPreview : undefined} />
        </div>
        <div class="facts">
            {#if chunks.length}
                <div class="opts">
                    {#each chunks as block, i (i)}<pre class="chunk">{block}</pre>{/each}
                </div>
            {/if}
        </div>
    </div>
    {#snippet footer()}
        <Button icon={LStar} fill={starred ? 'currentColor' : 'none'} aria-pressed={starred} onclick={onstar}>{starred ? 'Unstar' : 'Star'}</Button>
        {#if canEdit}<Button icon={LPencil} onclick={onedit}>Edit</Button>{/if}
        {#if more.length}
            <Menu items={more} label="More wildcard actions">
                {#snippet trigger(p)}<Button {...p}>More <Icon icon={LChevronDown} /></Button>{/snippet}
            </Menu>
        {/if}
        <Button variant={active ? 'danger' : 'primary'} icon={active ? LMinus : LPlus} onclick={onuse}>{active ? 'Remove wildcard' : 'Add wildcard'}</Button>
    {/snippet}
</Modal>

<style>
    .mi { display: flex; gap: var(--space-3); align-items: flex-start; min-width: 0; }
    .pv { flex: 0 0 220px; min-width: 0; }
    .facts { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
    .opts { height: min(320px, 50vh); overflow: auto; overscroll-behavior: contain; color: var(--color-ink-2); font-size: var(--text-ui); line-height: 1.5; }
    .chunk { margin: 0; white-space: pre; font: inherit; content-visibility: auto; contain-intrinsic-size: auto 960px; }
    @container (max-width: 560px) { .mi { flex-direction: column; } .pv { flex: none; width: 100%; } }
    @media (max-width: 560px) { .mi { flex-direction: column; } .pv { flex: none; width: 100%; } }
</style>
