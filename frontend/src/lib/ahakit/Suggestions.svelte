<script lang="ts" generics="T extends SuggestItem">
  import type { Snippet } from 'svelte';
  import { caretRect, onOutside, placePopover, portal, uid } from './util';
  import type { SuggestItem } from './types';

  type Props = {
    anchor?: HTMLElement | null;
    items: T[];
    open?: boolean;
    active?: number;
    caret?: boolean;
    matchWidth?: boolean;
    label?: string;
    empty?: string;
    id?: string;
    item?: Snippet<[T, boolean]>;
    onpick: (item: T, index: number) => void;
    onclose?: () => void;
  };
  let { anchor, items, open = $bindable(false), active = $bindable(0), caret = false, matchWidth = true, label = 'Suggestions', empty, id = uid('sg'), item, onpick, onclose }: Props = $props();

  let el: HTMLUListElement | undefined = $state();
  let pos = $state('');
  const field = $derived(anchor ? ((anchor.matches('input, textarea') ? anchor : anchor.querySelector('textarea, input')) as HTMLInputElement | HTMLTextAreaElement | null) : null);
  const shown = $derived(open && !!field && (items.length > 0 || !!empty));
  const ok = (i: number) => !!items[i] && !items[i].disabled;

  function close() {
    if (!open) return;
    open = false;
    onclose?.();
  }
  function pick(i: number) {
    if (!ok(i)) return;
    const it = items[i];
    close();
    onpick(it, i);
  }
  function step(d: number) {
    const n = items.length;
    for (let k = 1; k <= n; k++) {
      const j = (active + d * k + n * k) % n;
      if (ok(j)) return (active = j);
    }
  }
  function place() {
    if (!el || !field) return;
    pos = placePopover(caret ? caretRect(field) : field, el, 'bottom', !caret && matchWidth);
  }

  $effect(() => {
    if (ok(active) || !items.length) return;
    const f = items.findIndex((x) => !x.disabled);
    active = f < 0 ? 0 : f;
  });
  $effect(() => {
    void items.length;
    if (shown && el) place();
  });
  $effect(() => {
    if (shown && el) el.querySelector(`#${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  });

  $effect(() => {
    const f = field;
    if (!f) return;
    const combo = f.tagName === 'INPUT';
    const set = (k: string, v: string | null) => (v === null ? f.removeAttribute(k) : f.setAttribute(k, v));
    set('aria-autocomplete', 'list');
    if (combo) set('role', 'combobox');
    if (combo) set('aria-expanded', String(shown));
    set('aria-controls', shown ? id : null);
    set('aria-activedescendant', shown && ok(active) ? `${id}-${active}` : null);
    return () => ['aria-controls', 'aria-activedescendant'].forEach((k) => f.removeAttribute(k));
  });

  $effect(() => {
    const f = field;
    if (!f || !shown) return;
    const key = (ev: Event) => {
      const e = ev as KeyboardEvent;
      const k = e.key;
      if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (k === 'ArrowDown' || k === 'ArrowUp') step(k === 'ArrowDown' ? 1 : -1);
      else if ((k === 'Enter' || k === 'Tab') && !e.shiftKey && ok(active)) pick(active);
      else if (k === 'Escape') close();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const blur = () => setTimeout(() => document.activeElement !== f && close(), 120);
    const re = () => place();
    f.addEventListener('keydown', key, true);
    f.addEventListener('blur', blur);
    const evs = ['scroll', 'click', 'input', 'keyup'];
    evs.forEach((k) => f.addEventListener(k, re));
    addEventListener('resize', re);
    const off = onOutside(() => [f, el], close);
    return () => {
      f.removeEventListener('keydown', key, true);
      f.removeEventListener('blur', blur);
      evs.forEach((k) => f.removeEventListener(k, re));
      removeEventListener('resize', re);
      off();
    };
  });
</script>

{#if shown}
  <ul bind:this={el} use:portal {id} class="ui-sg anim-dd fixed z-50 box-border max-h-[250px] max-w-[calc(100vw-16px)] min-w-[180px] list-none overflow-y-auto overscroll-contain rounded-ui bg-raised p-1 text-ui text-ink shadow-[var(--shadow-md)]" role="listbox" aria-label={label} style={pos}>
    {#each items as it, i (it.id ?? i)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        id="{id}-{i}"
        role="option"
        aria-selected={i === active}
        aria-disabled={it.disabled || undefined}
        class="flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 aria-disabled:cursor-default aria-disabled:opacity-45 pointer-coarse:min-h-10 {i === active ? 'bg-active' : 'hover:bg-hover'}"
        onmousedown={(e) => e.preventDefault()}
        onmousemove={() => ok(i) && (active = i)}
        onclick={() => pick(i)}
      >
        {#if item}{@render item(it, i === active)}{:else}
          {#if it.icon}{@const I = it.icon}<I size={15} class="shrink-0 text-ink-2" aria-hidden="true" />{/if}
          <span class="min-w-0 flex-1 truncate">{it.label}</span>
          {#if it.detail}<span class="ml-2 shrink-0 truncate text-small text-ink-3">{it.detail}</span>{/if}
        {/if}
      </li>
    {:else}
      <li class="px-2 py-1.5 text-ink-3" role="option" aria-selected="false" aria-disabled="true">{empty}</li>
    {/each}
  </ul>
{/if}

