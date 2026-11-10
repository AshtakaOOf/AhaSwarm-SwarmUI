<script lang="ts">
  import type { Snippet } from 'svelte';
  import { longPress, onOutside, placePopover, portal, uid } from './util';

  type Props = {
    text?: string;
    content?: Snippet;
    placement?: 'top' | 'bottom';
    delay?: number;
    touch?: 'longpress' | 'tap' | 'none';
    disabled?: boolean;
    id?: string;
    children: Snippet;
  };
  let { text, content, placement = 'top', delay = 500, touch = 'longpress', disabled = false, id = uid('tip'), children }: Props = $props();

  let wrap: HTMLSpanElement | undefined = $state();
  let tip: HTMLDivElement | undefined = $state();
  let open = $state(false);
  let pos = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastTouch = 0;
  const target = () => (wrap?.firstElementChild as HTMLElement | null) ?? wrap;

  function show(wait = 0) {
    clearTimeout(timer);
    if (disabled || (!text && !content)) return;
    timer = setTimeout(() => (open = true), wait);
  }
  function hide() {
    clearTimeout(timer);
    open = false;
  }
  $effect(() => {
    const t = target();
    if (!t) return;
    t.setAttribute('aria-describedby', id);
    return () => t.removeAttribute('aria-describedby');
  });
  $effect(() => {
    if (!open || !tip || !wrap) return;
    pos = placePopover(target() ?? wrap, tip, placement, false, 'center');
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('keydown', esc);
    const off = onOutside(() => [wrap], hide);
    const auto = Date.now() - lastTouch < 800 ? setTimeout(hide, 2500) : undefined;
    return () => {
      document.removeEventListener('keydown', esc);
      off();
      clearTimeout(auto);
    };
  });
  $effect(() => () => clearTimeout(timer));
  $effect(() => {
    if (!wrap || touch !== 'longpress') return;
    const lp = longPress(wrap, { onlong: () => ((lastTouch = Date.now()), show()) });
    return lp.destroy;
  });

  const mouse = () => Date.now() - lastTouch > 800;
  function focusin(e: FocusEvent) {
    let kb = true;
    try {
      kb = (e.target as Element).matches(':focus-visible');
    } catch {}
    if (kb) show(Math.min(delay, 150));
  }
  function tap() {
    if (touch !== 'tap') return;
    lastTouch = Date.now();
    open ? hide() : show();
  }
</script>

<span
  class="inline-flex max-w-full [-webkit-touch-callout:none]"
  role="presentation"
  bind:this={wrap}
  onmouseenter={() => mouse() && show(delay)}
  onmouseleave={() => mouse() && hide()}
  onmousedown={() => mouse() && hide()}
  onfocusin={focusin}
  onfocusout={hide}
  ontouchstart={() => (lastTouch = Date.now())}
  ontouchend={tap}
>
  {@render children()}
</span>
<div bind:this={tip} use:portal {id} class="pop {open ? 'on' : ''} pointer-events-none! fixed z-[60] box-border max-w-[min(280px,calc(100vw-16px))] rounded-sm bg-active px-2 py-1 text-small leading-[16px] text-ink shadow-[var(--shadow-sm)]" role="tooltip" style={pos}>
  {#if content}{@render content()}{:else}{text}{/if}
</div>

