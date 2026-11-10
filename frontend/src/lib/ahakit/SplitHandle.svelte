<script lang="ts">
  import { clamp } from './util';

  type Props = {
    size?: number;
    collapsed?: boolean;
    direction?: 'horizontal' | 'vertical';
    min?: number;
    max?: number;
    defaultSize?: number;
    unit?: 'px' | '%';
    step?: number;
    reverse?: boolean;
    collapsible?: boolean;
    persistKey?: string;
    label?: string;
    controls?: string;
    onresize?: (size: number) => void;
    oncollapse?: (collapsed: boolean) => void;
    /** CSS selector of things the edge toggle must not sit over (e.g. bar controls along the edge) */
    avoid?: string;
    preview?: number | null;
    animating?: boolean;
    /** collapsible panes: the live drag size never goes below this many px (e.g. a toolbar row) */
    dragFloor?: number;
    collapseTo?: number;
  };
  let {
    size = $bindable(),
    collapsed = $bindable(false),
    direction = 'horizontal',
    min = 0,
    max = Infinity,
    defaultSize,
    unit = 'px',
    step,
    reverse = false,
    collapsible = false,
    persistKey,
    label = 'Resize',
    controls,
    onresize,
    oncollapse,
    avoid,
    preview = $bindable(null),
    animating = $bindable(false),
    dragFloor = 0,
    collapseTo = 0,
  }: Props = $props();

  let el: HTMLDivElement | undefined = $state();
  let dragging = $state(false);
  const horiz = $derived(direction === 'horizontal');
  const paneName = $derived(label.replace(/^Resize\s+/i, ''));
  const fwd = $derived(reverse ? !collapsed : collapsed);
  const chev = $derived(horiz ? (fwd ? 'M9.5 6l6 6-6 6' : 'M14.5 6L8.5 12l6 6') : fwd ? 'M6 9.5l6 6 6-6' : 'M6 14.5l6-6 6 6');
  const hi = $derived(unit === '%' ? Math.min(max, 100) : max);
  const key = $derived(persistKey ? `ui-split:${persistKey}` : '');

  (function init() {
    if (size === undefined) size = defaultSize ?? min;
    if (!persistKey) return;
    try {
      const s = JSON.parse(localStorage.getItem(`ui-split:${persistKey}`) || 'null');
      if (s && typeof s.size === 'number') (size = s.size), (collapsed = !!s.collapsed && collapsible);
    } catch {}
  })();

  $effect(() => {
    const v = JSON.stringify({ size, collapsed });
    if (key) try { localStorage.setItem(key, v); } catch {}
  });

  function total() {
    const r = (wrap ?? el)?.parentElement?.getBoundingClientRect();
    return r ? (horiz ? r.width : r.height) : 0;
  }
  function set(v: number) {
    const t = total();
    const cap = unit === 'px' && t ? Math.min(hi, t) : hi;
    size = Math.round(clamp(v, min, Math.max(min, cap)) * 100) / 100;
    onresize?.(size);
  }
  function collapse(c: boolean) {
    if (!collapsible || c === collapsed) return;
    collapsed = c;
    oncollapse?.(c);
  }

  const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let animT = 0;
  function animateTo(fromV: number, to: number, done?: () => void) {
    clearTimeout(animT);
    if (reduce()) { preview = null; animating = false; done?.(); return; }
    preview = fromV;
    animating = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      preview = to;
      animT = window.setTimeout(() => { done?.(); preview = null; animating = false; }, 210);
    }));
  }
  // effective open size: never below the open minimum or the persistent collapsed strip
  const openSize = () => Math.max(size ?? defaultSize ?? min, min, collapseTo);
  function toggle() {
    if (!collapsible) return;
    const s0 = openSize();
    if (collapsed) { preview = collapseTo; collapse(false); animateTo(collapseTo, s0); }
    else animateTo(s0, collapseTo, () => collapse(true));
  }
  let raw = 0;
  let start = 0, from = 0, per = 1;
  function down(e: PointerEvent) {
    if (e.button !== 0 || !el) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.focus();
    dragging = true;
    start = horiz ? e.clientX : e.clientY;
    from = collapsed ? collapseTo : openSize();
    raw = from;
    clearTimeout(animT); animating = false;
    per = unit === '%' ? 100 / (total() || 1) : 1;
    document.documentElement.style.cursor = horiz ? 'col-resize' : 'row-resize';
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const d = ((horiz ? e.clientX : e.clientY) - start) * per * (reverse ? -1 : 1);
    const t = total();
    const cap = unit === 'px' && t ? Math.min(hi, t) : hi;
    raw = clamp(from + d, collapsible ? 0 : min, Math.max(min, cap));
    if (!collapsible) return set(raw);
    preview = Math.round(Math.max(raw, Math.min(dragFloor * per, min), collapseTo) * 100) / 100;
    if (raw >= min) set(raw);
  }
  function up(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    el?.releasePointerCapture(e.pointerId);
    document.documentElement.style.cursor = '';
    if (!collapsible || preview === null) return;
    const shown = preview;
    const threshold = collapseTo + (min - collapseTo) / 2;
    if (raw < threshold) animateTo(shown, collapseTo, () => collapse(true));
    else if (raw < min) { collapse(false); set(min); animateTo(shown, min); }
    else { collapse(false); preview = null; }
  }
  function keydown(e: KeyboardEvent) {
    const k = e.key;
    const inc = horiz ? (reverse ? 'ArrowLeft' : 'ArrowRight') : reverse ? 'ArrowUp' : 'ArrowDown';
    const dec = horiz ? (reverse ? 'ArrowRight' : 'ArrowLeft') : reverse ? 'ArrowDown' : 'ArrowUp';
    const s = (step ?? (unit === '%' ? 2 : 16)) * (e.shiftKey ? 5 : 1);
    if (k === inc || k === dec) collapse(false), set((size ?? 0) + (k === inc ? s : -s));
    else if (k === 'Home') collapse(false), set(min);
    else if (k === 'End' && isFinite(hi)) collapse(false), set(hi);
    else if (k === 'Enter' && collapsible) collapse(!collapsed);
    else return;
    e.preventDefault();
  }
  const PROX = 48, MARGIN = 4;
  let wrap: HTMLDivElement | undefined = $state();
  let tog: HTMLButtonElement | undefined = $state();
  let kbFocus = false;
  // soft drop shadow only when the chevron sits over real content (image, control, text)
  const CONTENT = 'img, video, canvas, svg, input, textarea, select, button, [role=slider], [role=switch], .ctl, .chip';
  const CLICKABLE = 'a[href], button, input, select, textarea, summary, label, [role=button], [role=tab], [role=slider], [role=switch], [role=checkbox], [role=menuitem], [role=option], [tabindex]:not([tabindex="-1"]), .ctl, .chip';
  let geo: { parent: Element; x: number; y: number; w: number; h: number } | null = null, offset = 0;
  function rect(): DOMRect | null {
    if (!tog) return null;
    if (tog.offsetParent && tog.offsetWidth) geo = { parent: tog.offsetParent, x: tog.offsetLeft, y: tog.offsetTop, w: tog.offsetWidth, h: tog.offsetHeight };
    if (!geo) return null;
    const p = geo.parent.getBoundingClientRect();
    return new DOMRect(p.left + geo.x + (horiz ? 0 : offset), p.top + geo.y + (horiz ? offset : 0), geo.w, geo.h);
  }
  function shade() {
    if (!tog) return;
    const r = rect();
    if (!r) return;
    const top = (x: number, y: number) => document.elementsFromPoint(x, y).find((n) => !tog!.contains(n) && !wrap?.contains(n));
    const pts: [number, number][] = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]];
    const covers = (c: Element | null | undefined) => { const b = c?.getBoundingClientRect(); return !!b && !(b.width > r.width * 3 && b.height > r.height * 3); };
    const blocked = pts.some(([x, y]) => covers(top(x, y)?.closest(CLICKABLE)));
    tog.classList.toggle('blocked', blocked);
    if (blocked) return;
    const under = top(pts[0][0], pts[0][1]);
    let on = !!under && !!(under.closest(CONTENT));
    if (under && !on) {
      for (const n of Array.from(under.childNodes)) if (n.nodeType === 3 && n.textContent?.trim()) { on = true; break; }
    }
    tog.classList.toggle('over', on);
  }
  function place(d: number) {
    if (!tog) return;
    offset = d;
    tog.style.transition = d ? '' : 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)';
    tog.style.transform = d ? (horiz ? `translateY(${d}px)` : `translateX(${d}px)`) : '';
    if (!d) setTimeout(shade, 540); // after drifting back to centre
  }

  $effect(() => {
    const host = wrap?.parentElement;
    if (!collapsible || !host || !wrap) return;
    const coarse = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;
    let raf = 0, last: PointerEvent | null = null, cur = 0;
    function frame() {
      raf = 0;
      const e = last;
      if (!e || !wrap || !tog || dragging || kbFocus || coarse?.matches) return;
      const r = wrap.getBoundingClientRect();
      const len = horiz ? r.height : r.width;
      const half = (horiz ? tog.offsetHeight : tog.offsetWidth) / 2;
      const line = horiz ? r.left + r.width / 2 : r.top + r.height / 2;
      const across = Math.abs((horiz ? e.clientX : e.clientY) - line);
      const along = (horiz ? e.clientY - r.top : e.clientX - r.left);
      let d = 0;
      if (e.type !== 'pointerleave' && across <= PROX && along >= 0 && along <= len) {
        let t = clamp(along, half + MARGIN, len - half - MARGIN);
        if (avoid) {
          const blocks = Array.from(document.querySelectorAll<HTMLElement>(avoid)).map((b) => b.getBoundingClientRect())
            .filter((b) => b.width && b.height)
            .map((b) => (horiz ? [b.top - r.top, b.bottom - r.top] : [b.left - r.left, b.right - r.left]))
            .map(([a, z]) => [a - half - MARGIN, z + half + MARGIN] as [number, number]);
          for (const [a, z] of blocks) if (t > a && t < z) t = t - a < z - t && a >= half + MARGIN ? a : z <= len - half - MARGIN ? z : a;
          if (blocks.some(([a, z]) => t > a && t < z)) t = len / 2;
        }
        d = Math.round(t - len / 2);
      }
      if (d !== cur) place((cur = d));
      shade();
    }
    // re-check what is under the chevron after layout settles (pane resized, image loaded, content scrolled)
    const settle = () => requestAnimationFrame(shade);
    let idle = 0;
    const scrolled = () => { clearTimeout(idle); idle = window.setTimeout(shade, 120); };
    const ro = new ResizeObserver(settle);
    ro.observe(host);
    host.addEventListener('scroll', scrolled, { capture: true, passive: true });
    host.addEventListener('load', settle, true);
    settle();
    const onmove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      last = e;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    host.addEventListener('pointermove', onmove);
    host.addEventListener('pointerleave', onmove);
    return () => {
      ro.disconnect();
      host.removeEventListener('scroll', scrolled, true);
      clearTimeout(idle);
      host.removeEventListener('load', settle, true);
      host.removeEventListener('pointermove', onmove);
      host.removeEventListener('pointerleave', onmove);
      if (raf) cancelAnimationFrame(raf);
    };
  });

  function reset() {
    collapse(false);
    if (defaultSize !== undefined) set(defaultSize);
  }
</script>

<div class="ui-split-wrap {direction}" bind:this={wrap}>
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={el}
  class="ui-split-handle {direction}"
  class:dragging
  class:collapsed
  role="separator"
  tabindex="0"
  aria-orientation={horiz ? 'vertical' : 'horizontal'}
  aria-label={label}
  aria-controls={controls}
  aria-valuenow={collapsed ? Math.round(collapseTo) : Math.round(size ?? 0)}
  aria-valuemin={collapsible ? Math.round(collapseTo) : min}
  aria-valuemax={isFinite(hi) ? hi : undefined}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onlostpointercapture={(e) => dragging && up(e)}
  ondblclick={reset}
  onkeydown={keydown}
></div>
{#if collapsible}
  <button
    bind:this={tog}
    type="button"
    class="ui-edge-toggle"
    onfocus={(e) => { if (e.currentTarget.matches(':focus-visible')) (kbFocus = true), place(0); }}
    onblur={() => (kbFocus = false)}
    class:before={reverse}
    class:vert={!horiz}
    aria-controls={controls}
    aria-expanded={!collapsed}
    aria-label="{collapsed ? 'Show' : 'Hide'} {paneName}"
    onclick={toggle}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="d" d={chev} /><path class="f" d={chev} />
    </svg>
  </button>
{/if}
</div>

<style>
  .ui-split-wrap {
    position: relative;
    z-index: 2;
    flex: none;
    display: flex;
  }
  .ui-split-wrap.vertical {
    flex-direction: column;
  }
  .ui-edge-toggle {
    position: absolute;
    top: 50%;
    left: 100%;
    z-index: 3;
    width: 28px;
    height: 44px;
    margin-top: -22px;
    display: grid;
    place-items: center;
    padding: 0;
    background: none;
    border: 0;
    border-radius: var(--radius-ui);
    color: var(--color-ink);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: transform 120ms ease-out;
    will-change: transform;
  }
  .ui-edge-toggle svg {
    transition: filter 120ms ease-out;
  }
  :global(.ui-edge-toggle.blocked) { display: none; }
  :global(.ui-edge-toggle.over) svg {
    filter: drop-shadow(0 1px 3px var(--color-overlay)) drop-shadow(0 0 6px var(--color-overlay));
  }
  .ui-edge-toggle.before {
    left: auto;
    right: 100%;
  }
  .ui-edge-toggle.vert {
    top: 100%;
    left: 50%;
    right: auto;
    width: 44px;
    height: 28px;
    margin: 0 0 0 -22px;
  }
  .ui-edge-toggle.vert.before {
    top: auto;
    bottom: 100%;
  }
  .ui-edge-toggle svg {
    width: 20px;
    height: 20px;
    display: block;
    overflow: visible;
  }
  .ui-edge-toggle path {
    stroke-width: 2.9;
    transition: transform 80ms ease-out;
  }
  .ui-edge-toggle .d {
    stroke: var(--color-thumb);
    transform: translateY(2.6px);
  }
  .ui-edge-toggle .f {
    stroke: var(--color-ink);
  }
  .ui-edge-toggle:hover .f {
    transform: translateY(-0.9px);
  }
  .ui-edge-toggle:active .f {
    transform: translateY(2.6px);
  }
  .ui-edge-toggle:focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 0;
  }
  @media (pointer: coarse) {
    .ui-edge-toggle {
      width: 44px;
    }
    .ui-edge-toggle.vert {
      height: 44px;
    }
    .ui-edge-toggle svg {
      width: 28px;
      height: 28px;
    }
  }
  .ui-split-handle {
    position: relative;
    z-index: 2;
    flex: none;
    background: var(--color-surface-2);
    touch-action: none;
    user-select: none;
    outline: none;
    transition: background-color var(--motion-fast);
  }
  .horizontal {
    width: var(--size-split);
    cursor: col-resize;
  }
  .vertical {
    height: var(--size-split);
    cursor: row-resize;
  }
  .ui-split-handle::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
  .horizontal::after {
    left: calc((var(--size-split-hit) - var(--size-split)) / -2);
    right: calc((var(--size-split-hit) - var(--size-split)) / -2);
  }
  .vertical::after {
    top: calc((var(--size-split-hit) - var(--size-split)) / -2);
    bottom: calc((var(--size-split-hit) - var(--size-split)) / -2);
  }
  .ui-split-handle:hover {
    background: var(--color-border-strong);
    transition-delay: 150ms;
  }
  .dragging,
  .dragging:hover,
  .ui-split-handle:focus-visible {
    background: var(--color-accent);
    transition-delay: 0s;
  }
</style>
