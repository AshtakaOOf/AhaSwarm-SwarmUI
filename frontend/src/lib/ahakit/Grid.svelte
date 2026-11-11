<script lang="ts">
  import type { Snippet } from 'svelte';
  let { cols = 2, min = '320px', balance = false, label, class: cls = '', onplan, children }: { cols?: number; min?: string; balance?: boolean; label?: string; class?: string; onplan?: (firstOfColumn: number[]) => void; children: Snippet } = $props();
  const ROW = 2;
  let el: HTMLDivElement | undefined = $state();
  let n = $state(1);

  // balance: columns are planned once from fully expanded heights, so opening or closing a section never moves anything
  let plan = new Map<Element, { col: number; full: number }>(), planN = 0;

  function fullHeight(c: HTMLElement): number {
    let h = c.getBoundingClientRect().height;
    // swap each collapsible body's current height for its content height, so the result is the same open, closed or mid-animation
    for (const t of c.querySelectorAll<HTMLElement>('[aria-expanded][aria-controls]')) {
      const body = document.getElementById(t.getAttribute('aria-controls')!);
      if (body && c.contains(body)) h += (body.firstElementChild ?? body).scrollHeight - body.clientHeight;
    }
    return h;
  }
  function planCols(items: HTMLElement[]): number[] {
    const full = items.map(fullHeight);
    const stale = planN !== n || plan.size !== items.length || items.some((c, i) => {
      const p = plan.get(c);
      return !p || Math.abs(p.full - full[i]) > Math.max(48, p.full * 0.2);
    });
    if (stale) {
      // tallest first into the shortest column evens the columns out best
      const tot = Array<number>(n).fill(0);
      plan = new Map();
      planN = n;
      for (const i of items.map((_, i) => i).sort((x, y) => full[y] - full[x])) {
        const col = tot.indexOf(Math.min(...tot));
        tot[col] += full[i];
        plan.set(items[i], { col, full: full[i] });
      }
      const first = new Map<number, number>();
      items.forEach((c, i) => { const col = plan.get(c)!.col; if (!first.has(col)) first.set(col, i); });
      onplan?.([...first.values()]);
    }
    return items.map((c) => plan.get(c)!.col);
  }

  function layout() {
    if (!el) return;
    const cs = getComputedStyle(el), gap = parseFloat(cs.columnGap) || 0;
    const minPx = parseFloat(min) || 320;
    n = Math.max(1, Math.min(cols, Math.floor((el.clientWidth + gap) / (minPx + gap))));
    const shown = (Array.from(el.children) as HTMLElement[]).filter((c) => c.getClientRects().length);
    const planned = balance ? planCols(shown.filter((c) => !c.classList.contains('aha-span'))) : [];
    const next = Array<number>(n).fill(1);
    let i = 0, b = 0;
    for (const c of shown) {
      const span = Math.max(1, Math.ceil((c.getBoundingClientRect().height + gap) / ROW));
      if (c.classList.contains('aha-span')) {
        const start = Math.max(...next);
        c.style.gridArea = `${start} / 1 / span ${span} / -1`;
        next.fill(start + span);
        i = 0;
        continue;
      }
      const col = balance ? planned[b++] : i++ % n;
      c.style.gridArea = `${next[col]} / ${col + 1} / span ${span} / span 1`;
      next[col] += span;
    }
  }
  $effect(() => {
    if (!el) return;
    void cols; void min; void balance;
    // one layout per frame; columns only change on a re-plan, so the size change a layout causes settles
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; layout(); }); };
    const ro = new ResizeObserver(schedule);
    const watch = () => { ro.disconnect(); ro.observe(el!); for (const c of el!.children) ro.observe(c); };
    const mo = new MutationObserver(() => { plan = new Map(); watch(); schedule(); });
    mo.observe(el, { childList: true });
    watch();
    layout();
    return () => { cancelAnimationFrame(frame); ro.disconnect(); mo.disconnect(); };
  });
</script>

<div bind:this={el} class="aha-grid {cls}" style:--grid-cols={n} style:--grid-row="{ROW}px" role={label ? 'group' : undefined} aria-label={label}>{@render children()}</div>
