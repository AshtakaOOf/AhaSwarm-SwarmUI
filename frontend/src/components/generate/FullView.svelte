<script lang="ts">
    import LX from '@lucide/svelte/icons/x';
    import LChevronLeft from '@lucide/svelte/icons/chevron-left';
    import LChevronRight from '@lucide/svelte/icons/chevron-right';
    import { ui } from '../../lib/state/ui.svelte';
    import { gen } from '../../lib/state/gen.svelte';
    import { resolveUrl } from '../../lib/api/client';
    import { fileName, mediaType } from '../../lib/util/metadata';
    import { portal, VideoPlayer } from '../ui';
    import ImageActions from './ImageActions.svelte';

    const item = $derived(ui.fullView);
    const idx = $derived(item ? gen.ordered.findIndex(o => o.src === item.src) : -1);
    let img: HTMLImageElement | undefined = $state();
    let stage: HTMLDivElement | undefined = $state();
    let s = $state(1), tx = $state(0), ty = $state(0), anim = $state(false);
    const pts = new Map<number, { x: number; y: number }>();
    let g: any = null, tap = 0, moved = false;
    const lim = (v: number, a: number) => Math.max(-a, Math.min(a, v));

    function resetView() { s = 1; tx = ty = 0; }
    function close() { ui.fullView = null; }
    function fix() {
        if (!img || !stage) return;
        if (s <= 1) { resetView(); return; }
        tx = lim(tx, Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2));
        ty = lim(ty, Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2));
    }
    function zoom(ns: number, x: number, y: number) {
        if (!stage) return;
        const r = stage.getBoundingClientRect(), cx = x - r.left - r.width / 2, cy = y - r.top - r.height / 2;
        ns = Math.max(1, Math.min(6, ns));
        tx = cx - (ns * (cx - tx)) / s; ty = cy - (ns * (cy - ty)) / s; s = ns; fix();
    }
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; };
    function down(e: PointerEvent) {
        if (e.button !== 0 || !stage) return;
        stage.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        anim = false; moved = false;
        if (pts.size === 2) g = { pinch: true, ...mid(), s, tx, ty };
        else if (pts.size === 1) g = { x: e.clientX, y: e.clientY, tx, ty };
    }
    function move(e: PointerEvent) {
        if (!pts.has(e.pointerId) || !g || !stage) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (g.pinch && pts.size === 2) {
            const m = mid(), r = stage.getBoundingClientRect(), cx = g.x - r.left - r.width / 2, cy = g.y - r.top - r.height / 2;
            const ns = Math.max(1, Math.min(6, (g.s * m.d) / g.d));
            tx = m.x - g.x + cx - (ns * (cx - g.tx)) / g.s; ty = m.y - g.y + cy - (ns * (cy - g.ty)) / g.s; s = ns; moved = true; fix();
            return;
        }
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        if (s > 1) { tx = g.tx + dx; ty = g.ty + dy; fix(); }
    }
    function up(e: PointerEvent) {
        if (!pts.delete(e.pointerId)) return;
        if (pts.size) { if (g?.pinch) { const [p] = pts.values(); g = { x: p.x, y: p.y, tx, ty }; } return; }
        g = null;
        if (moved || e.pointerType === 'mouse') return;
        if (e.timeStamp - tap < 300) { tap = 0; anim = true; if (s > 1) resetView(); else zoom(2.5, e.clientX, e.clientY); }
        else tap = e.timeStamp;
    }
    function step(d: number) {
        const next = gen.ordered[idx + d];
        if (next) { gen.current = next; ui.fullView = { src: next.src, metadata: next.metadata }; resetView(); }
    }
    $effect(() => {
        if (!item || !stage) return;
        const k = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); }
            else if (e.key === 'ArrowLeft' && idx > 0) step(-1);
            else if (e.key === 'ArrowRight' && idx !== -1) step(1);
        };
        const wheel = (e: WheelEvent) => { e.preventDefault(); anim = false; zoom(s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); };
        const st = stage;
        addEventListener('keydown', k, true);
        st.addEventListener('wheel', wheel, { passive: false });
        return () => { removeEventListener('keydown', k, true); st.removeEventListener('wheel', wheel); };
    });
    $effect(() => { void item?.src; resetView(); });
</script>

{#if item}
    {@const it = item}
    <div use:portal class="viewer" role="dialog" aria-modal="true" aria-label="Image viewer: {fileName(it.src)}">
        <div class="backdrop"></div>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div bind:this={stage} class="stage" class:zoomed={s > 1} role="presentation"
            onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}
            ondblclick={(e: MouseEvent) => { anim = true; if (s > 1) resetView(); else zoom(2.5, e.clientX, e.clientY); }}
            onclick={(e: MouseEvent) => { if (!moved && e.target === stage) close(); }}>
            {#if mediaType(it.src) === 'video'}
                <VideoPlayer src={resolveUrl(it.src)} label={fileName(it.src)} />
            {:else}
                <img bind:this={img} src={resolveUrl(it.src)} alt={fileName(it.src)} draggable="false" class:anim style="transform: translate({tx}px, {ty}px) scale({s})" />
            {/if}
        </div>
        <div class="top">
            <ImageActions item={it} ondone={close} />
            <span class="fill"></span>
            <button class="ctl ctl-icon btn" onclick={close} aria-label="Close (Esc)" title="Close (Esc)"><LX size={20} aria-hidden="true" /></button>
        </div>
        {#if idx !== -1}
            {#if idx > 0}<button class="ctl ctl-icon btn nav prev" onclick={() => step(-1)} aria-label="Previous image (←)" title="Previous image (←)"><LChevronLeft size={20} aria-hidden="true" /></button>{/if}
            {#if idx < gen.ordered.length - 1}<button class="ctl ctl-icon btn nav next" onclick={() => step(1)} aria-label="Next image (→)" title="Next image (→)"><LChevronRight size={20} aria-hidden="true" /></button>{/if}
        {/if}
    </div>
{/if}

<style>
    .viewer { position: fixed; inset: 0; z-index: 45; isolation: isolate; display: flex; flex-direction: column; animation: vin 160ms ease-out; }
    @keyframes vin { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .viewer { animation: none; } }
    .backdrop { position: absolute; inset: 0; background: var(--color-backdrop-strong); }
    .stage { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 5vh; touch-action: none; user-select: none; cursor: zoom-in; }
    .stage.zoomed { cursor: grab; }
    .stage img, .stage :global(.ui-video) { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: var(--radius-ui); box-shadow: var(--shadow-media); }
    .stage img.anim { transition: transform 200ms ease-out; }
    .top { position: absolute; z-index: 2; inset: 0 0 auto 0; display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-3); pointer-events: none; }
    .top > :global(*) { pointer-events: auto; }
    .fill { flex: 1; pointer-events: none !important; }
    .btn { z-index: 2; background: var(--color-raised); color: var(--color-ink); border-radius: var(--radius-ui); box-shadow: var(--shadow-float-strong); }
    .btn:hover { background: var(--color-hover); }
    .nav { position: absolute; top: 50%; margin-top: -16px; }
    .prev { left: var(--space-3); }
    .next { right: var(--space-3); }
    @media (pointer: coarse) { .btn { width: 44px; height: 44px; } .stage { padding: 0; } }
</style>
