<script lang="ts">
    import LImage from '@lucide/svelte/icons/image';
    import LStar from '@lucide/svelte/icons/star';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import { mediaType, parseMetadata } from '../../lib/util/metadata';
    import { reuseParams, toggleStar, useAsInit } from '../../lib/state/actions';
    import { imageMoreItems } from '../../lib/state/imageMenu';
    import { Button, Icon, Menu, type MenuItem } from '../ui';
    import EditorButton from './EditorButton.svelte';

    let { item, ondone }: { item: { src: string; metadata: string | null }; ondone?: () => void } = $props();
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
        ...imageMoreItems(cur),
    ] : []);

</script>

<div class="ui-dense acts" role="toolbar" aria-label="Image actions">
    <EditorButton />
    {#if !isData}<Button variant={isStarred ? 'primary' : 'default'} icon={LStar} fill={isStarred ? 'currentColor' : 'none'} onclick={star}>{isStarred ? 'Starred' : 'Star'}</Button>{/if}
    <Button onclick={() => { reuseParams(cur.metadata); ondone?.(); }}>Reuse Parameters</Button>
    <Menu items={moreItems} label="More image actions">
        {#snippet trigger(p)}<Button {...p}>More <Icon icon={ChevronDown} /></Button>{/snippet}
    </Menu>
</div>

<style>
    .acts { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .acts :global(.ctl:not(.ctl-strong)) { box-shadow: var(--shadow-float); }
    .acts :global(.ui-group-btns .ctl) { box-shadow: none; }
</style>
