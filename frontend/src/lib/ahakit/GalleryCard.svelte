<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import ImageOff from '@lucide/svelte/icons/image-off';
  import ImageIcon from '@lucide/svelte/icons/image';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { cachedImage, holdImage, loadImage } from './imageCache';

  type Props = {
    src: string;
    alt?: string;
    title?: string;
    caption?: string;
    /** short label over the media (bottom left), e.g. "Intermediate" or a progress %, instead of a caption bar */
    badge?: string;
    rowHeight?: string;
    ratio?: string;
    selected?: boolean;
    aspect?: string;
    fit?: 'cover' | 'contain';
    eager?: boolean;
    video?: boolean;
    autoplay?: boolean;
    /** `src` changes in place (live previews): keep the last frame shown instead of fading each new one in */
    live?: boolean;
    busy?: boolean;
    cache?: boolean;
    selectable?: boolean;
    checked?: boolean;
    selecting?: boolean;
    onclick?: (e: MouseEvent) => void;
    oncontextmenu?: (e: MouseEvent) => void;
    oncheck?: (checked: boolean, e: MouseEvent) => void;
    overlay?: Snippet;
    placeholder?: string;
  };
  let { src, alt = '', title, caption, badge, rowHeight, ratio, selected = false, aspect = '1 / 1', fit = 'cover', eager = false, video = false, autoplay = true, live = false, busy = false, cache = false, selectable = false, checked = $bindable(false), selecting = false, onclick, oncontextmenu, oncheck, overlay, placeholder }: Props = $props();

  let img: HTMLImageElement | undefined = $state();
  const useCache = $derived(cache && !video && !live);
  let cachedSrc = $state<string | undefined>(untrack(() => (useCache ? cachedImage(src) : undefined)));
  const shownSrc = $derived(useCache ? cachedSrc ?? '' : src);
  $effect(() => {
    if (!useCache || !src) return;
    let alive = true;
    let release = () => {};
    const hit = cachedImage(src);
    if (hit) { cachedSrc = hit; release = holdImage(src); }
    else loadImage(src).then((u) => { if (!alive) return; cachedSrc = u; release = holdImage(src); });
    return () => { alive = false; release(); };
  });
  let vid: HTMLVideoElement | undefined = $state();
  let status = $state<'loading' | 'done' | 'error'>('loading');
  let natural = $state<string | null>(null);

  $effect(() => {
    const el = img;
    void shownSrc;
    untrack(() => {
      if (!shownSrc) status = 'loading';
      else if (!live || status !== 'done') status = el?.complete && el.naturalWidth ? 'done' : 'loading';
    });
  });
  $effect(() => {
    if (!vid) return;
    if (autoplay) vid.play().catch(() => {});
    else vid.pause();
  });
  const loaded = (w: number, h: number) => {
    status = 'done';
    if (w && h) natural = `${w} / ${h}`;
  };
</script>

<figure class="card group relative isolate m-0 flex min-w-0 flex-col overflow-hidden rounded-ui {selected || checked ? 'bg-active is-sel' : onclick ? 'bg-panel hover:bg-hover' : 'bg-panel'} {selecting || checked ? 'is-selecting' : ''} {rowHeight ? 'is-row' : ''}" style:height={rowHeight} {title} {oncontextmenu}>
  <svelte:element this={onclick ? 'button' : 'div'} class="card-btn shim relative block {rowHeight ? 'h-full w-auto' : 'w-full'} overflow-hidden bg-[var(--color-media)] p-0 {onclick ? 'cursor-pointer focus-visible:shadow-[inset_0_0_0_2px_var(--color-ring)]' : ''} {status === 'loading' && (src || !placeholder) ? 'is-loading' : ''}" style="aspect-ratio: {aspect === 'auto' ? natural ?? ratio ?? '1 / 1' : aspect}" type={onclick ? 'button' : undefined} aria-pressed={onclick ? selected : undefined} aria-label={onclick ? alt || title || caption : undefined} role={onclick ? undefined : 'presentation'} {onclick}>
    {#if video}
      <video
        bind:this={vid}
        {src}
        class="absolute inset-0 z-[1] h-full w-full {fit === 'contain' ? 'object-contain' : 'object-cover'} {status === 'done' ? 'opacity-100' : 'opacity-0'}"
        muted
        loop
        playsinline
        preload="metadata"
        aria-label={alt}
        onloadeddata={(e) => loaded(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
        onerror={() => (status = 'error')}
      ></video>
    {:else if shownSrc}
      <img
        bind:this={img}
        src={shownSrc}
        {alt}
        class="absolute inset-0 z-[1] h-full w-full {live ? '' : 'transition-[opacity,filter,transform] duration-150'} group-hover:brightness-110 {fit === 'contain' ? 'object-contain' : 'object-cover'} {status === 'done' ? 'opacity-100' : 'opacity-0'}"
        loading={eager || live ? 'eager' : 'lazy'}
        decoding="async"
        draggable="false"
        onload={(e) => { const i = e.currentTarget as HTMLImageElement; loaded(i.naturalWidth, i.naturalHeight); }}
        onerror={() => (status = 'error')}
      />
    {/if}
    {#if !src && !video && placeholder}<span class="ph absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-3" role="img" aria-label={placeholder}><ImageIcon size={18} aria-hidden="true" /><span class="ph-text text-[11px]" aria-hidden="true">{placeholder}</span></span>{/if}
    {#if busy}<span class="absolute inset-0 z-[2] flex items-center justify-center text-ink-2" role="img" aria-label="Generating"><LoaderCircle size={15} class="animate-spin" aria-hidden="true" /></span>{/if}
    {#if status === 'error'}<span class="absolute inset-0 flex items-center justify-center text-ink-3" role="img" aria-label="Failed to load"><ImageOff size={15} aria-hidden="true" /></span>{/if}
  </svelte:element>
  {#if selectable}
    <button
      type="button"
      class="check absolute top-0 left-0 z-[3] flex h-7 w-7 items-center justify-center p-0 transition-opacity duration-100 {selecting || checked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'}"
      role="checkbox"
      aria-checked={checked}
      aria-label="Select {alt || title || caption || 'image'}"
      onclick={(e) => {
        e.stopPropagation();
        checked = !checked;
        oncheck?.(checked, e);
      }}><span class="box card-check-box flex h-4 w-4 items-center justify-center rounded-sm {checked ? 'bg-ink text-base' : 'bg-[var(--color-backdrop)] text-transparent shadow-[inset_0_0_0_1.5px_var(--color-ink-2)] hover:text-ink-2'}"><Check size={12} strokeWidth={3} aria-hidden="true" /></span></button
    >
  {/if}
  {#if overlay}<div class="overlay absolute top-1 right-1 z-[3] flex gap-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">{@render overlay()}</div>{/if}
  {#if badge}<span class="badge pointer-events-none absolute bottom-1 left-1 z-[3] max-w-[calc(100%-8px)] truncate rounded-sm px-1 text-small leading-[16px]">{badge}</span>{/if}
  {#if caption}<figcaption class="truncate px-1.5 py-1 text-small leading-[16px] {selected || checked ? 'text-ink' : 'text-ink-2'}">{caption}</figcaption>{/if}
</figure>

<style>
  /* row layout: as wide as the media at the row height (never wider than the row) */
  .is-row { flex: none; width: max-content; max-width: 100%; }
  .badge { background: var(--color-overlay); color: var(--color-on-overlay); }
  .is-sel > :global(.card-btn)::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px var(--color-selected-ring);
    background: var(--color-veil);
    pointer-events: none;
  }
  .is-sel {
    box-shadow: inset 0 0 0 2px var(--color-selected-ring);
  }
  .overlay :global(.ctl) {
    background: var(--color-float-btn);
    color: var(--color-ink);
    box-shadow: var(--shadow-float);
  }
  .overlay :global(.ctl:hover) {
    background: var(--color-float-btn-hover);
  }
  .overlay :global(.ctl[aria-pressed='true']) {
    background: var(--color-pressed);
    color: var(--color-on-pressed);
  }
  @media (forced-colors: active) {
    .is-sel > :global(.card-btn)::after { outline: 2px solid Highlight; outline-offset: -2px; }
    .is-sel { outline: 2px solid Highlight; outline-offset: -2px; }
    .card-check-box { forced-color-adjust: none; background: Canvas; color: transparent; outline: 1px solid CanvasText; outline-offset: -1px; box-shadow: none; }
    [aria-checked='true'] > .card-check-box { background: Highlight; color: HighlightText; outline-color: Highlight; }
  }
  .ph { container-type: size; }
  @container (max-width: 72px) or (max-height: 56px) { .ph-text { display: none; } }
</style>
