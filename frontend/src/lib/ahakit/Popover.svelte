<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onOutside, placePopover, portal, uid } from './util';
  import type { PopoverTriggerProps } from './types';

  type Props = {
    open?: boolean;
    title?: string;
    label?: string;
    placement?: 'bottom' | 'top';
    autofocus?: boolean;
    id?: string;
    trigger: Snippet<[PopoverTriggerProps]>;
    compact?: boolean;
    flush?: boolean;
    wide?: boolean;
    dismissable?: boolean;
    follow?: boolean;
    // pin below the app top bar, full width (layout only)
    pin?: 'top';
    // pinned height (e.g. 65dvh), or 'auto' to shrink wrap up to 50dvh
    pinHeight?: string;
    children: Snippet;
    onclose?: () => void;
  };
  let { open = $bindable(false), title, label, placement = 'bottom', autofocus = false, compact = false, flush = false, wide = false, dismissable = true, follow = false, pin, pinHeight, id = uid('pop'), trigger, children, onclose }: Props = $props();

  let wrap: HTMLSpanElement | undefined = $state();
  let pop: HTMLDivElement | undefined = $state();
  let pos = $state('');
  const anchor = () => (wrap?.firstElementChild as HTMLElement | null) ?? wrap;
  const parentId = $derived(open ? wrap?.closest('.ui-pop')?.id : undefined);
  const children_ = () => [...document.querySelectorAll(`.ui-pop[data-parent="${id}"]`)];

  function close(refocus = false) {
    if (!open) return;
    open = false;
    onclose?.();
    if (refocus) anchor()?.focus();
  }
  $effect(() => {
    if (!open || !pop || !wrap) return;
    const re = () => {
      if (!pop) return;
      if (pin === 'top') {
        const h = pinHeight ?? '50dvh';
        pos = h === 'auto'
          ? 'top:var(--app-top, 0px);left:0;width:100%;height:auto;max-width:none;max-height:calc(50dvh - var(--app-top, 0px))'
          : `top:var(--app-top, 0px);left:0;width:100%;height:calc(${h} - var(--app-top, 0px));max-width:none;max-height:none;overflow:hidden`;
        return;
      }
      pos = placePopover(anchor() ?? wrap!, pop, placement, false);
    };
    re();
    if (autofocus) pop.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || children_().length) return;
      e.preventDefault();
      close(!!pop?.contains(document.activeElement) || document.activeElement === anchor());
    };
    addEventListener('resize', re);
    let raf = 0;
    if (follow) {
      const tick = () => { re(); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    const stop = () => {
      removeEventListener('resize', re);
      if (raf) cancelAnimationFrame(raf);
    };
    if (!dismissable) return stop;
    document.addEventListener('keydown', esc);
    const off = onOutside(() => [wrap, pop, ...children_()], () => close());
    return () => {
      document.removeEventListener('keydown', esc);
      stop();
      off();
    };
  });

  const tp: PopoverTriggerProps = $derived({
    id: `${id}-t`,
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': id,
    onclick: () => (open ? close() : (open = true)),
  });
</script>

<span class="inline-flex" bind:this={wrap}>{@render trigger(tp)}</span>
{#if open}
  <div bind:this={pop} use:portal {id} data-parent={parentId} class="ui-pop pop on fixed z-50 box-border max-h-[60vh] w-max {wide ? 'max-w-[min(480px,calc(100vw-16px))]' : 'max-w-[min(320px,calc(100vw-16px))]'} {pin ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'} rounded-ui bg-popover {flush ? 'p-0' : compact ? 'p-2' : 'p-4'} text-ui leading-[19px] text-ink shadow-[var(--shadow-lg)] outline-none" role="dialog" aria-modal="false" aria-label={title ? undefined : label} aria-labelledby={title ? `${id}-h` : undefined} tabindex="-1" style={pos}>
    {#if title}<div class="font-semibold text-ink {compact ? 'mb-1.5 px-0.5 text-small' : 'mb-1'} {flush ? (compact ? 'px-2.5 pt-2' : 'px-4 pt-4') : ''}" id="{id}-h">{title}</div>{/if}
    <div class="min-h-0 text-ink-2 [&_p]:mb-2 [&_p:last-child]:mb-0 {pin ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''}">{@render children()}</div>
  </div>
{/if}

