<script lang="ts">
  import type { Snippet } from 'svelte';
  import GalleryCard from './GalleryCard.svelte';
  import { rangeSelect } from './util';
  import type { GalleryItem } from './types';

  type Key = string | number;
  type Props = {
    items?: GalleryItem[];
    selected?: GalleryItem['id'] | Key[];
    multiple?: boolean;
    minSize?: number;
    aspect?: string;
    label?: string;
    onselect?: (item: GalleryItem, index: number) => void;
    onselectionchange?: (keys: Key[]) => void;
    item?: Snippet<[GalleryItem, number]>;
  };
  let { items = [], selected = $bindable(), multiple = false, minSize = 160, aspect, label = 'Images', onselect, onselectionchange, item }: Props = $props();

  let anchorKey: Key | undefined;
  const key = (it: GalleryItem, i: number): Key => it.id ?? i;
  const list = $derived(Array.isArray(selected) ? selected : []);
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;

  function set(next: Key[]) {
    selected = next;
    onselectionchange?.(next);
  }
  function pick(it: GalleryItem, i: number, e: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}) {
    const k = key(it, i);
    if (multiple) {
      set(rangeSelect(items.map(key), list, anchorKey, k, e, touch && list.length > 0));
      if (!e.shiftKey) anchorKey = k;
    } else selected = k;
    onselect?.(it, i);
  }
</script>

<div class="m-0 grid list-none gap-2.5 p-0 max-[480px]:grid-cols-2" style="grid-template-columns: repeat(auto-fill, minmax({minSize}px, 1fr))" role="listbox" tabindex="-1" aria-label={label} aria-multiselectable={multiple || undefined}>
  {#each items as it, i (it.id ?? i)}
    {@const k = key(it, i)}
    <div class="min-w-0" role="option" aria-selected={multiple ? list.includes(k) : k === selected}>
      {#if item}{@render item(it, i)}{:else if multiple}
        <GalleryCard src={it.src} alt={it.alt} title={it.title} caption={it.caption} {aspect} selectable selecting={list.length > 0} checked={list.includes(k)} onclick={(e) => pick(it, i, e)} oncheck={(_, e) => pick(it, i, { shiftKey: e.shiftKey, ctrlKey: true })} />
      {:else}
        <GalleryCard src={it.src} alt={it.alt} title={it.title} caption={it.caption} {aspect} selected={k === selected} onclick={() => pick(it, i)} />
      {/if}
    </div>
  {/each}
</div>

