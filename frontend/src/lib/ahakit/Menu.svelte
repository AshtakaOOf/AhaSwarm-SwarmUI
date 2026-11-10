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
  };
  let { items, open = $bindable(false), label, id = uid('menu'), context = false, target, trigger, onselect }: Props = $props();
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

  const tp: MenuTriggerProps = $derived({
    id: `${id}-t`,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onclick: () => {
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
    <MenuList {items} anchor={at} {id} {label} labelledby={label || !trigger ? undefined : `${id}-t`} focusLast={last} onpick={pick} onback={() => close()} />
  {/key}
{/if}

