<script lang="ts">
    import LImage from '@lucide/svelte/icons/image';
    import LEraser from '@lucide/svelte/icons/eraser';
    import LStar from '@lucide/svelte/icons/star';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import { mediaType, parseMetadata } from '../../lib/util/metadata';
    import { hasPermission } from '../../lib/api/swarm';
    import { reuseParams, toggleStar, useAsInit } from '../../lib/state/actions';
    import { imageMoreItems } from '../../lib/state/imageMenu';
    import { gen } from '../../lib/state/gen.svelte';
    import { Button, Icon, Menu, type MenuItem } from '../ui';
    import EditorButton from './EditorButton.svelte';

    let { item, ondone, rail = false }: { item: { src: string; metadata: string | null }; ondone?: () => void; rail?: boolean } = $props();
    const cur = $derived(item);
    const kind = $derived(mediaType(item.src));
    const isData = $derived(!!item.src?.startsWith('data:'));

    let starred = $state<Record<string, boolean>>({});
    const isStarred = $derived(cur ? (starred[cur.src] ?? !!parseMetadata(cur.metadata)?.raw?.is_starred) : false);

    async function star() {
        if (!cur) {
            return;
        }
        const s = await toggleStar(cur.src);
        if (s !== null) {
            starred[cur.src] = s;
        }
    }

    const moreItems = $derived<MenuItem[]>(cur ? [
        ...((kind === 'image' || kind === 'video') ? [{ label: 'Use As Init', icon: LImage, onselect: () => { useAsInit(cur.src); ondone?.(); } }] : []),
        ...imageMoreItems(cur, ondone),
        { label: 'Clear current', icon: LEraser, title: 'Clears this image from the current area. It stays in the batch and history.', onselect: () => { gen.current = null; ondone?.(); } },
    ] : []);

</script>

<div class="ui-dense acts" class:rail role="toolbar" aria-label="Image actions">
    <EditorButton src={cur.src} {ondone} />
    {#if !isData && hasPermission('user_star_images')}<Button variant={isStarred ? 'primary' : 'default'} icon={LStar} fill={isStarred ? 'currentColor' : 'none'} onclick={star}>{isStarred ? 'Starred' : 'Star'}</Button>{/if}
    <Button onclick={() => { reuseParams(cur.metadata); ondone?.(); }}>Reuse Parameters</Button>
    <Menu items={moreItems} label="More image actions">
        {#snippet trigger(p)}<Button {...p}>More <Icon icon={ChevronDown} /></Button>{/snippet}
    </Menu>
</div>

<style>
    .acts { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .acts.rail { flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; touch-action: pan-x; }
    .acts.rail > :global(*) { flex: none; }
    .acts :global(.ctl:not(.ctl-strong)) { box-shadow: var(--shadow-float); }
    .acts :global(.ui-group-btns .ctl) { box-shadow: none; }
</style>
