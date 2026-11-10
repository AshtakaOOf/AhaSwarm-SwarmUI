<script lang="ts">
  import IconButton from './IconButton.svelte';
  import X from '@lucide/svelte/icons/x';
  import Info from '@lucide/svelte/icons/info';
  import Check from '@lucide/svelte/icons/check';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { fade } from 'svelte/transition';
  import { safeUrl } from './sanitize';
  import { dismiss, pause, resume, toasts } from './toasts.svelte';
  import type { ToastPosition } from './types';

  let { position = 'bottom-right', anchor }: { position?: ToastPosition; anchor?: string } = $props();
  const GAP = 8, EDGE = 8;
  let box = $state<{ right: number; bottom: number; width: number } | null>(null);
  const reduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  function place(r: DOMRect) {
    if (innerWidth < 480) return { right: EDGE, bottom: innerHeight - r.top + GAP, width: innerWidth - 2 * EDGE };
    const right = Math.max(0, innerWidth - r.right);
    return { right, bottom: innerHeight - r.top + GAP, width: Math.min(320, innerWidth - right - EDGE) };
  }
  function locate() {
    if (!anchor) return null;
    let covered: DOMRect | null = null;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(anchor))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && el.contains(hit)) return place(r);
      if (!covered && hit?.closest('.ui-modal:not(.drawer)') && !el.closest('.ui-modal')) covered = r;
    }
    return covered && place(covered);
  }
  const SETTLE = 400;
  $effect(() => {
    if (!anchor || !toasts.length) return;
    let raf = 0, until = 0;
    const tick = () => {
      const b = locate();
      if (b?.right !== box?.right || b?.bottom !== box?.bottom || b?.width !== box?.width) box = b;
      raf = performance.now() < until ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { until = performance.now() + SETTLE; if (!raf) raf = requestAnimationFrame(tick); };
    const drag = (e: PointerEvent) => { if (e.buttons) kick(); };
    const opts = { capture: true, passive: true };
    const evs = ['pointerdown', 'pointerup', 'keydown', 'keyup', 'scroll', 'transitionend', 'animationend'] as const;
    for (const ev of evs) addEventListener(ev, kick, opts);
    addEventListener('pointermove', drag, opts);
    addEventListener('resize', kick);
    kick();
    return () => {
      for (const ev of evs) removeEventListener(ev, kick, opts);
      removeEventListener('pointermove', drag, opts);
      removeEventListener('resize', kick);
      cancelAnimationFrame(raf);
    };
  });
</script>

<div class="ui-toasts {box ? 'anchored' : position}" role="region" aria-label="Notifications"
  style:right={box ? `${box.right}px` : undefined} style:bottom={box ? `${box.bottom}px` : undefined} style:width={box ? `${box.width}px` : undefined}>
  {#each toasts as t (t.id)}
    <div class="toast {t.kind}" role={t.kind === 'error' ? 'alert' : 'status'} aria-live={t.kind === 'error' ? 'assertive' : 'polite'} data-toast={t.kind}
      onpointerenter={() => pause(t.id)} onpointerleave={() => resume(t.id)} out:fade={{ duration: reduce?.matches ? 0 : 150 }}>
      {#if t.kind === 'error' || t.kind === 'warning'}<TriangleAlert size={16} class="ti shrink-0" aria-hidden="true" />{:else if t.kind === 'success'}<Check size={16} class="ti shrink-0" aria-hidden="true" />{:else}<Info size={16} class="ti shrink-0" aria-hidden="true" />{/if}
      <div class="msg">
        {#if t.title}<strong>{t.title}</strong>{/if}
        <span>{t.message}{#if t.count > 1}<span class="count tabular-nums">×{t.count}</span>{/if}</span>
        {#if t.action}
          {#if safeUrl(t.action.href)}<a class="act" href={safeUrl(t.action.href)} target="_blank" rel="noopener noreferrer" onclick={() => dismiss(t.id)}>{t.action.label}</a>
          {:else}<button type="button" class="act" onclick={() => { t.action?.onclick?.(); dismiss(t.id); }}>{t.action.label}</button>{/if}
        {/if}
      </div>
      <span class="x ui-dense"><IconButton icon={X} label="Dismiss" onclick={() => dismiss(t.id)} /></span>
    </div>
  {/each}
</div>

<style>
  .ui-toasts {
    position: fixed;
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: var(--size-toast);
    max-width: calc(100% - var(--space-5) * 2);
    padding-bottom: env(safe-area-inset-bottom);
    pointer-events: none;
    font-family: var(--font-sans);
  }
  .bottom-right {
    right: var(--space-5);
    bottom: var(--space-5);
  }
  .top-right {
    right: var(--space-5);
    top: var(--space-5);
  }
  .top-left {
    left: var(--space-5);
    top: var(--space-5);
  }
  .bottom-left {
    left: var(--space-5);
    bottom: var(--space-5);
  }
  .bottom-center,
  .top-center {
    left: 50%;
    transform: translateX(-50%);
  }
  .bottom-center {
    bottom: var(--space-5);
  }
  .top-left,
  .top-center,
  .top-right {
    padding-bottom: 0;
    margin-top: env(safe-area-inset-top);
  }
  .top-center {
    top: var(--space-5);
  }
  .toast {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    box-sizing: border-box;
    padding: var(--space-3);
    font-size: var(--text-ui);
    line-height: 20px;
    color: var(--color-text);
    background: var(--color-raised);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    pointer-events: auto;
    animation: ui-toast-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .anchored {
    max-width: none;
    padding-bottom: 0;
  }
  .toast > :global(.ti) {
    margin-top: 2px;
    color: var(--color-ink-2);
  }
  .x {
    flex: none;
    display: flex;
    margin: -2px -4px -2px 0;
  }
  .success > :global(.ti) {
    color: var(--color-success);
  }
  .warning > :global(.ti),
  .warning .msg {
    color: var(--color-warning);
  }
  .count {
    margin-left: 0.3em;
    color: var(--color-ink-3);
  }
  .act {
    align-self: flex-start;
    padding: 0;
    font: inherit;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .act:hover {
    color: var(--color-text-strong);
  }
  .error {
    background: var(--color-danger-soft);
  }
  .error > :global(.ti) {
    color: var(--color-danger-fg);
  }
  .msg {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    word-break: break-word;
  }
  strong {
    font-weight: var(--font-weight-bold);
  }
  strong + span {
    color: var(--color-text-muted);
  }
  @keyframes ui-toast-in {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
