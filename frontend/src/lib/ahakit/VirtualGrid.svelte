<script lang="ts" generics="T">
  // windowed grid / list for long collections (centred columns) (model browsers, history)
  import type { Snippet } from 'svelte';

  type Columns = number | { min: number } | { width: number };
  type Props = {
    items: T[];
    key: (item: T, index: number) => unknown;
    columns: Columns;
    rowHeight: number;
    gap?: number;
    colGap?: number;
    /** extra content mounted above and below the viewport, in screens (fast scrolling never shows blank cards) */
    overscan?: number;
    class?: string;
    label?: string;
    scroller?: HTMLElement;
    item: Snippet<[T, number]>;
  };
  let { items, key, columns, rowHeight, gap = 8, colGap = gap, overscan = 2, class: cls = '', label, scroller, item }: Props = $props();

  let outer: HTMLDivElement | undefined = $state();
  let width = $state(0);
  let viewTop = $state(0);
  let viewH = $state(0);
  let offset = $state(0);

  const cols = $derived(
    typeof columns === 'number' ? Math.max(1, columns)
    : 'min' in columns ? Math.max(1, Math.floor((width + colGap) / (columns.min + colGap)))
    : Math.max(1, Math.floor((width + colGap) / (columns.width + colGap))),
  );
  const used = $derived(Math.max(1, Math.min(cols, items.length)));
  const template = $derived(
    typeof columns === 'number' ? `repeat(${cols}, minmax(0, 1fr))`
    : 'width' in columns ? `repeat(${used}, ${columns.width}px)`
    : `repeat(${used}, minmax(0, ${Math.round(columns.min * 1.6)}px))`,
  );
  const stride = $derived(rowHeight + gap);
  const rows = $derived(Math.ceil(items.length / cols));
  const total = $derived(rows ? rows * stride - gap : 0);
  const extra = $derived(Math.ceil((viewH * overscan) / stride) + 1);
  const first = $derived(Math.max(0, Math.floor((viewTop - offset) / stride) - extra));
  const last = $derived(viewH ? Math.min(rows, Math.ceil((viewTop - offset + viewH) / stride) + extra) : 0);
  const visible = $derived(items.slice(first * cols, last * cols));

  function findScroller(el: HTMLElement): HTMLElement {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
    }
    return document.scrollingElement as HTMLElement;
  }

  $effect(() => {
    const el = outer;
    if (!el) return;
    const sc = scroller ?? findScroller(el);
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!sc.clientHeight) { viewH = 0; return; }
      if (!sc.scrollTop && viewTop > 0 && !viewH) sc.scrollTop = viewTop;
      viewTop = sc.scrollTop;
      viewH = sc.clientHeight;
      offset = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const ro = new ResizeObserver(() => { width = el.clientWidth; schedule(); });
    ro.observe(el);
    ro.observe(sc);
    sc.addEventListener('scroll', schedule, { passive: true });
    width = el.clientWidth;
    measure();
    return () => { ro.disconnect(); sc.removeEventListener('scroll', schedule); cancelAnimationFrame(frame); };
  });
</script>

<div bind:this={outer} class="ui-vgrid" style="height: {total}px" role={label ? 'group' : undefined} aria-label={label}>
  <div class="ui-vgrid-win {cls}" style="transform: translateY({first * stride}px); grid-template-columns: {template}; justify-content: center; grid-auto-rows: {rowHeight}px; row-gap: {gap}px; column-gap: {colGap}px">
    {#each visible as it, i (key(it, first * cols + i))}{@render item(it, first * cols + i)}{/each}
  </div>
</div>

<style>
  .ui-vgrid { position: relative; width: 100%; contain: layout; }
  .ui-vgrid-win { position: absolute; top: 0; left: 0; right: 0; display: grid; margin: 0 !important; will-change: transform; }
</style>
