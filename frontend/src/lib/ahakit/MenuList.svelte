<script lang="ts">
  import Self from './MenuList.svelte';
  import Check from '@lucide/svelte/icons/check';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { placePopover, portal, type RectLike } from './util';
  import type { MenuItem } from './types';

  type Props = {
    items: MenuItem[];
    anchor: Element | RectLike;
    id: string;
    label?: string;
    labelledby?: string;
    sub?: boolean;
    focusLast?: boolean;
    onpick: (item: MenuItem) => void;
    onback: (all?: boolean) => void;
  };
  let { items, anchor, id, label, labelledby, sub = false, focusLast = false, onpick, onback }: Props = $props();

  let el: HTMLDivElement | undefined = $state();
  let pos = $state('');
  let open = $state(-1);
  let openKey = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const leading = $derived(items.some((i) => i.icon || i.checked !== undefined));
  const nodes = () => Array.from(el?.querySelectorAll<HTMLElement>(':scope > [data-i]') ?? []);
  const usable = () => nodes().filter((n) => n.getAttribute('aria-disabled') !== 'true');

  $effect(() => {
    if (!el) return;
    pos = placePopover(anchor, el, sub ? 'right' : 'bottom', !sub);
    const u = usable();
    (focusLast ? u[u.length - 1] : u[0])?.focus();
    const re = () => el && (pos = placePopover(anchor, el, sub ? 'right' : 'bottom', !sub));
    addEventListener('resize', re);
    return () => {
      removeEventListener('resize', re);
      clearTimeout(timer);
    };
  });

  function move(d: number, abs?: number) {
    const u = usable();
    if (!u.length) return;
    const k = abs ?? (u.indexOf(document.activeElement as HTMLElement) + d + u.length) % u.length;
    u[k]?.focus();
  }
  function activate(i: number, key = false) {
    const it = items[i];
    if (!it || it.disabled) return;
    if (it.items?.length) {
      openKey = key;
      open = i;
    } else onpick(it);
  }
  function hover(i: number, e: PointerEvent) {
    clearTimeout(timer);
    if (e.pointerType === 'mouse') (e.currentTarget as HTMLElement).focus();
    if (open !== i) timer = setTimeout(() => (open = items[i]?.items?.length && !items[i].disabled ? i : -1), 120);
  }
  function key(e: KeyboardEvent, i: number) {
    const k = e.key;
    if (k === 'ArrowDown') move(1);
    else if (k === 'ArrowUp') move(-1);
    else if (k === 'Home') move(0, 0);
    else if (k === 'End') move(0, usable().length - 1);
    else if (k === 'Enter' || k === ' ' || (k === 'ArrowRight' && items[i].items?.length)) activate(i, true);
    else if (k === 'ArrowLeft' && sub) onback();
    else if (k === 'Escape') onback(false);
    else if (k === 'Tab') onback(true);
    else if (k.length === 1 && /\S/.test(k)) {
      const u = usable();
      const start = u.indexOf(document.activeElement as HTMLElement);
      const hit = [...u.slice(start + 1), ...u.slice(0, start + 1)].find((n) => n.textContent?.trim().toLowerCase().startsWith(k.toLowerCase()));
      hit?.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  }
  function closeSub(all?: boolean) {
    const i = open;
    open = -1;
    if (all) onback(true);
    else el?.querySelector<HTMLElement>(`:scope > [data-i="${i}"]`)?.focus();
  }
</script>

<div bind:this={el} use:portal {id} class="ui-menu anim-dd fixed z-50 box-border max-h-[60vh] min-w-[160px] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-ui bg-raised p-1 text-ui text-ink shadow-[var(--shadow-md)] outline-none" role="menu" aria-label={label} aria-labelledby={labelledby} tabindex="-1" style={pos}>
  {#each items as it, i (it.id ?? i)}
    {#if it.separator}
      <div class="mx-1 my-1 h-px bg-hover" role="separator"></div>
    {:else}
      <div
        data-i={i}
        id="{id}-{i}"
        class="flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 whitespace-nowrap outline-none select-none hover:bg-hover focus:bg-active aria-disabled:cursor-not-allowed aria-disabled:opacity-45 {open === i ? 'bg-active' : ''} {it.danger ? 'text-[var(--color-danger-text)]' : ''}"
        role={it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
        aria-checked={it.checked}
        aria-disabled={it.disabled || undefined}
        aria-haspopup={it.items?.length ? 'menu' : undefined}
        aria-expanded={it.items?.length ? open === i : undefined}
        tabindex="-1"
        onclick={() => activate(i)}
        onkeydown={(e) => key(e, i)}
        onpointerenter={(e) => hover(i, e)}
      >
        {#if leading}<span class="inline-flex w-[15px] shrink-0 {it.danger ? '' : 'text-ink-2'}">{#if it.checked}<Check size={15} aria-hidden="true" />{:else if it.icon}{@const I = it.icon}<I size={15} aria-hidden="true" fill={it.fill ?? 'none'} />{/if}</span>{/if}
        <span class="min-w-0 flex-1 truncate">{it.label}</span>
        {#if it.shortcut}<kbd class="kbd ml-2.5">{it.shortcut}</kbd>{/if}
        {#if it.items?.length}<ChevronRight size={15} class="ml-auto shrink-0 text-ink-3" aria-hidden="true" />{/if}
      </div>
      {#if open === i && it.items && el}
        <Self items={it.items} anchor={el.querySelector(`:scope > [data-i="${i}"]`) ?? el} id="{id}-{i}-m" labelledby="{id}-{i}" sub focusLast={false} onpick={onpick} onback={closeSub} />
      {/if}
    {/if}
  {/each}
</div>

