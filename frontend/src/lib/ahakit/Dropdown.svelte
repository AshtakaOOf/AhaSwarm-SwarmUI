<script lang="ts" generics="V extends Value">
  import Field from './Field.svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Check from '@lucide/svelte/icons/check';
  import Search from '@lucide/svelte/icons/search';
  import { placePopover, portal, uid } from './util';
  import type { Option, Size, Value } from './types';

  type Props = {
    options: Option<V>[];
    value?: V;
    placeholder?: string;
    label?: string;
    hint?: string;
    title?: string;
    disabled?: boolean;
    size?: Size;
    searchable?: boolean;
    ariaLabel?: string;
    id?: string;
    class?: string;
    onchange?: (value: V, option: Option<V>) => void;
  };
  let { options, value = $bindable(), placeholder = 'Select…', label, hint, title, disabled = false, size = 'md', searchable, ariaLabel, id = uid('dd'), class: cls = '', onchange }: Props = $props();

  const listId = $derived(`${id}-list`);
  let open = $state(false);
  let active = $state(-1);
  let query = $state('');
  let btn: HTMLButtonElement | undefined = $state();
  let pop: HTMLDivElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();
  let search: HTMLInputElement | undefined = $state();
  let pos = $state('');
  let typed = '';
  let typedAt = 0;

  const find = $derived(searchable ?? options.length > 6);
  const selected = $derived(options.find((o) => o.value === value));
  const view = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const all = options.map((o, i) => ({ o, i }));
    return q ? all.filter(({ o }) => o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)) : all;
  });
  const enabled = (j: number) => j >= 0 && j < view.length && !view[j].o.disabled;

  function place() {
    if (btn && pop) pos = placePopover(btn, pop);
  }

  function show() {
    if (disabled || open) return;
    query = '';
    open = true;
    active = Math.max(0, view.findIndex((x) => x.o.value === value));
    if (!enabled(active)) active = move(active, 1);
  }
  function hide(refocus = true) {
    open = false;
    if (refocus) btn?.focus();
  }
  function choose(j: number) {
    if (!enabled(j)) return;
    const o = view[j].o;
    value = o.value;
    hide();
    onchange?.(o.value, o);
  }
  function move(from: number, dir: number) {
    for (let j = from + dir; j >= 0 && j < view.length; j += dir) if (enabled(j)) return j;
    return from;
  }

  function keydown(e: KeyboardEvent) {
    const k = e.key;
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') e.preventDefault(), show();
      return;
    }
    const inSearch = e.target === search;
    if (k === 'ArrowDown') active = move(active, 1);
    else if (k === 'ArrowUp') active = move(active, -1);
    else if (k === 'Home' && !inSearch) active = move(-1, 1);
    else if (k === 'End' && !inSearch) active = move(view.length, -1);
    else if (k === 'PageDown') active = move(Math.min(active + 9, view.length), -1);
    else if (k === 'PageUp') active = move(Math.max(active - 9, -1), 1);
    else if (k === 'Enter' || (k === ' ' && !inSearch)) choose(active);
    else if (k === 'Escape') e.stopPropagation(), hide();
    else if (k === 'Tab') return hide(false);
    else if (k.length === 1 && !find) {
      const now = Date.now();
      typed = (now - typedAt > 600 ? '' : typed) + k.toLowerCase();
      typedAt = now;
      const i = view.findIndex((x, j) => !x.o.disabled && x.o.label.toLowerCase().startsWith(typed) && (typed.length > 1 || j > active));
      const j = i >= 0 ? i : view.findIndex((x) => !x.o.disabled && x.o.label.toLowerCase().startsWith(typed));
      if (j >= 0) active = j;
    } else return;
    e.preventDefault();
  }

  $effect(() => {
    void query;
    if (open && !enabled(active)) active = move(-1, 1);
  });

  $effect(() => {
    if (!open) return;
    place();
    if (find) search?.focus();
    const out = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn?.contains(t) && !pop?.contains(t)) hide(false);
    };
    const scroll = (e: Event) => {
      if (e.target !== list) place();
    };
    document.addEventListener('pointerdown', out, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', out, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', place);
    };
  });

  $effect(() => {
    if (open && active >= 0) list?.children[active]?.scrollIntoView({ block: 'nearest' });
  });
</script>

<Field {label} {hint} {title} forId={id}>
  <button
    bind:this={btn}
    type="button"
    role="combobox"
    class="ctl w-full min-w-0 justify-between disabled:opacity-45 {open ? 'bg-hover' : ''} {cls}"
    {id}
    {disabled}
    {title}
    aria-label={ariaLabel}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={listId}
    aria-activedescendant={open && !find && active >= 0 ? `${id}-o${view[active]?.i}` : undefined}
    onclick={() => (open ? hide() : show())}
    onkeydown={keydown}
  >
    <span class="min-w-0 truncate {selected ? '' : 'text-ink-3'}">{selected?.label ?? placeholder}</span>
    <ChevronDown size={15} class="shrink-0 text-ink-3" aria-hidden="true" />
  </button>
</Field>

{#if open}
  <div use:portal bind:this={pop} class="anim-dd fixed z-50 flex max-h-[60vh] flex-col overflow-hidden rounded-ui bg-raised p-1 shadow-[var(--shadow-md)]" style="{pos};width:max-content;max-width:min(400px, calc(100vw - 8px))">
    {#if find}
      <label class="relative mb-1 block">
        <Search size={15} class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          bind:this={search}
          bind:value={query}
          type="text"
          placeholder="Filter…"
          autocomplete="off"
          spellcheck="false"
          aria-label="Filter options"
          aria-controls={listId}
          aria-activedescendant={active >= 0 && view[active] ? `${id}-o${view[active].i}` : undefined}
          onkeydown={keydown}
          class="ctl ctl-field w-full justify-start bg-panel pl-8 placeholder:text-ink-3 hover:bg-panel focus:bg-panel"
        />
      </label>
    {/if}
    <ul bind:this={list} id={listId} role="listbox" class="min-h-0 overflow-y-auto overscroll-contain" aria-labelledby={ariaLabel ? undefined : id} aria-label={ariaLabel} tabindex="-1">
      {#each view as { o, i }, j (o.value)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          id="{id}-o{i}"
          role="option"
          class="flex w-full cursor-default items-start gap-2 rounded-sm px-2 py-1 text-left text-ui aria-disabled:opacity-45 pointer-coarse:min-h-10 pointer-coarse:items-center {j === active ? 'bg-active' : 'hover:bg-hover'}"
          aria-selected={o.value === value}
          aria-disabled={o.disabled || undefined}
          onpointermove={() => !o.disabled && (active = j)}
          onclick={() => choose(j)}
        >
          <span class="min-w-0 flex-1 truncate whitespace-nowrap">{o.label}</span>
          {#if o.value === value}<Check size={15} class="mt-[2px] shrink-0 text-ink-2 pointer-coarse:mt-0" aria-hidden="true" />{/if}
        </li>
      {:else}
        <li class="px-2 py-1 text-ui text-ink-3" role="option" aria-selected="false" aria-disabled="true">No matches</li>
      {/each}
    </ul>
  </div>
{/if}

