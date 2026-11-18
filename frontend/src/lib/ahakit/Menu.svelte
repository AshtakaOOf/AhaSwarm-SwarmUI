<script lang="ts">
  import type { Snippet } from 'svelte';
  import MenuList from './MenuList.svelte';
  import { longPress, onOutside, pointRect, uid, type RectLike } from './util';
  import type { MenuItem, MenuTriggerProps } from './types';

  type Props = {
    items: MenuItem[];
    open?: boolean;
    label?: string;
    id?: string;
    context?: boolean;
    target?: HTMLElement | null;
    trigger?: Snippet<[MenuTriggerProps]>;
    onselect?: (item: MenuItem) => void;
    dense?: boolean;
    holdOpen?: boolean;
  };
  let { items, open = $bindable(false), label, id = uid('menu'), context = false, target, trigger, onselect, dense = false, holdOpen = false }: Props = $props();
  let wrap: HTMLSpanElement | undefined = $state();
  let last = $state(false);
  let point = $state<RectLike | null>(null);
  let restore: HTMLElement | null = null;
  const anchor = () => (wrap?.firstElementChild as HTMLElement | null) ?? wrap;

  export function openAt(x: number, y: number) {
    if (!open) restore = document.activeElement as HTMLElement | null;
    point = pointRect(x, y);
    last = false;
    open = true;
  }
  function close(refocus = true) {
    open = false;
    if (refocus) (point ? restore : anchor())?.focus?.();
    point = null;
  }
  function pick(it: MenuItem) {
    close();
    it.onselect?.();
    onselect?.(it);
  }
  $effect(() => {
    if (!open) return;
    return onOutside(() => [wrap, ...document.querySelectorAll('.ui-menu')], () => close(false));
  });
  $effect(() => {
    const t = target ?? (context ? anchor() : null);
    if (!t || !context) return;
    const ctx = (e: MouseEvent) => {
      e.preventDefault();
      const r = t.getBoundingClientRect();
      if (!e.clientX && !e.clientY) openAt(r.left, r.bottom);
      else openAt(e.clientX, e.clientY);
    };
    t.addEventListener('contextmenu', ctx);
    const lp = longPress(t, { onlong: openAt });
    return () => {
      t.removeEventListener('contextmenu', ctx);
      lp.destroy();
    };
  });

  // hold the trigger, slide onto an item, release to choose it
  let heldAt = 0;
  $effect(() => {
    if (!holdOpen || !trigger) return;
    const t = anchor();
    if (!t) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let holding = false;
    let sx = 0;
    let sy = 0;
    const itemAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]');
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const p = e.touches[0];
      sx = p.clientX;
      sy = p.clientY;
      clearTimeout(timer);
      timer = setTimeout(() => {
        holding = true;
        heldAt = Date.now();
        openAt(sx, sy);
      }, 350);
    };
    const move = (e: TouchEvent) => {
      const p = e.touches[0];
      if (!p) return;
      if (!holding) {
        if (Math.hypot(p.clientX - sx, p.clientY - sy) > 10) clearTimeout(timer);
        return;
      }
      const hit = itemAt(p.clientX, p.clientY);
      for (const n of document.querySelectorAll<HTMLElement>('.ui-menu [role="menuitem"], .ui-menu [role="menuitemcheckbox"]')) {
        if (n !== hit && document.activeElement === n) n.blur();
      }
      hit?.focus();
    };
    const end = (e: TouchEvent) => {
      clearTimeout(timer);
      if (!holding) return;
      holding = false;
      if (e.cancelable) e.preventDefault();
      const p = e.changedTouches[0];
      const hit = p && itemAt(p.clientX, p.clientY);
      const i = hit?.dataset?.i;
      if (i !== undefined) {
        const it = items[Number(i)];
        if (it && !it.disabled && !it.items?.length) pick(it);
      }
    };
    const cancel = () => { clearTimeout(timer); holding = false; };
    t.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', cancel);
    return () => {
      clearTimeout(timer);
      t.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', cancel);
    };
  });

  const tp: MenuTriggerProps = $derived({
    id: `${id}-t`,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onclick: () => {
      if (Date.now() - heldAt < 600) return;
      last = false;
      point = null;
      open = !open;
    },
    onkeydown: (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      last = e.key === 'ArrowUp';
      point = null;
      open = true;
    },
  });
  const at = $derived(point ?? anchor());
</script>

{#if trigger}<span class="inline-flex" bind:this={wrap}>{@render trigger(tp)}</span>{/if}
{#if open && at}
  {#key point}
    <MenuList {items} anchor={at} {id} {label} labelledby={label || !trigger ? undefined : `${id}-t`} focusLast={last} {dense} onpick={pick} onback={() => close()} />
  {/key}
{/if}

