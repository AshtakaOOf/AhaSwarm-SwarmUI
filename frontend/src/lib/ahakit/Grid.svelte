<script lang="ts">
  import type { Snippet } from 'svelte';
  let { cols = 2, min = '320px', label, class: cls = '', children }: { cols?: number; min?: string; label?: string; class?: string; children: Snippet } = $props();
  const ROW = 2;
  let el: HTMLDivElement | undefined = $state();
  let n = $state(1);

  function layout() {
    if (!el) return;
    const cs = getComputedStyle(el), gap = parseFloat(cs.columnGap) || 0;
    const minPx = parseFloat(min) || 320;
    n = Math.max(1, Math.min(cols, Math.floor((el.clientWidth + gap) / (minPx + gap))));
    const next = Array<number>(n).fill(1);
    let i = 0;
    for (const c of Array.from(el.children) as HTMLElement[]) {
      if (!c.getClientRects().length) continue;
      const span = Math.max(1, Math.ceil((c.getBoundingClientRect().height + gap) / ROW));
      if (c.classList.contains('aha-span')) {
        const start = Math.max(...next);
        c.style.gridArea = `${start} / 1 / span ${span} / -1`;
        next.fill(start + span);
        i = 0;
        continue;
      }
      const col = i++ % n;
      c.style.gridArea = `${next[col]} / ${col + 1} / span ${span} / span 1`;
      next[col] += span;
    }
  }
  $effect(() => {
    if (!el) return;
    void cols; void min;
    const ro = new ResizeObserver(layout);
    const watch = () => { ro.disconnect(); ro.observe(el!); for (const c of el!.children) ro.observe(c); };
    const mo = new MutationObserver(() => { watch(); layout(); });
    mo.observe(el, { childList: true });
    watch();
    layout();
    return () => { ro.disconnect(); mo.disconnect(); };
  });
</script>

<div bind:this={el} class="aha-grid {cls}" style:--grid-cols={n} style:--grid-row="{ROW}px" role={label ? 'group' : undefined} aria-label={label}>{@render children()}</div>
