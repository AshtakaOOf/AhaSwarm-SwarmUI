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
    dismissable?: boolean;
    follow?: boolean;
    children: Snippet;
    onclose?: () => void;
  };
  let { open = $bindable(false), title, label, placement = 'bottom', autofocus = false, compact = false, flush = false, dismissable = true, follow = false, id = uid('pop'), trigger, children, onclose }: Props = $props();

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
    const re = () => pop && (pos = placePopover(anchor() ?? wrap!, pop, placement, false));
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
  <div bind:this={pop} use:portal {id} data-parent={parentId} class="ui-pop pop on fixed z-50 box-border max-h-[60vh] w-max max-w-[min(320px,calc(100vw-16px))] overflow-y-auto rounded-ui bg-popover {flush ? 'p-0' : compact ? 'p-2' : 'p-4'} text-ui leading-[19px] text-ink shadow-[var(--shadow-lg)] outline-none" role="dialog" aria-modal="false" aria-label={title ? undefined : label} aria-labelledby={title ? `${id}-h` : undefined} tabindex="-1" style={pos}>
    {#if title}<div class="font-semibold text-ink {compact ? 'mb-1.5 px-0.5 text-small' : 'mb-1'} {flush ? (compact ? 'px-2.5 pt-2' : 'px-4 pt-4') : ''}" id="{id}-h">{title}</div>{/if}
    <div class="text-ink-2 [&_p]:mb-2 [&_p:last-child]:mb-0">{@render children()}</div>
  </div>
{/if}

