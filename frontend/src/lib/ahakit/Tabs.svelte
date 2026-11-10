<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { MenuItem, TabItem } from './types';
  import SplitButton from './SplitButton.svelte';
  import { uid } from './util';

  type Props = {
    tabs: TabItem[];
    value?: string;
    id?: string;
    label?: string;
    onchange?: (id: string) => void;
    panel?: Snippet<[string]>;
    menus?: Record<string, MenuItem[]>;
  };
  let { tabs, value = $bindable(tabs[0]?.id), id = uid('tabs'), label, onchange, panel, menus }: Props = $props();
  let bar: HTMLDivElement | undefined = $state();
  const hasSel = $derived(tabs.some((t) => t.id === value));
  const firstOn = $derived(tabs.find((t) => !t.disabled)?.id);

  function select(t: TabItem) {
    if (t.disabled || t.id === value) return;
    value = t.id;
    onchange?.(t.id);
  }
  function keydown(e: KeyboardEvent) {
    const on = tabs.filter((t) => !t.disabled);
    const i = on.findIndex((t) => t.id === value);
    const k = e.key;
    const n = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? on.length - 1 : null;
    if (n === null || !on.length) return;
    e.preventDefault();
    const t = on[(n + on.length) % on.length];
    select(t);
    bar?.querySelector<HTMLElement>(`#${id}-t-${CSS.escape(t.id)}`)?.focus();
  }
</script>

<div class="flex min-w-0 flex-col">
  <div class="flex gap-1 overflow-x-auto outline-none [scrollbar-width:none]" role="tablist" aria-label={label} bind:this={bar} tabindex="-1" onkeydown={keydown}>
    {#each tabs as t (t.id)}
      {#if menus?.[t.id]?.length}
        <SplitButton variant="tab" selected={t.id === value} items={menus[t.id]} menuLabel="{t.label} pages" icon={t.icon}
          role="tab" id="{id}-t-{t.id}" aria-selected={t.id === value} aria-controls="{id}-p"
          tabindex={t.id === value || (!hasSel && t.id === firstOn) ? 0 : -1} disabled={t.disabled} onclick={() => select(t)}>{t.label}</SplitButton>
      {:else}
        <button
          type="button"
          role="tab"
          id="{id}-t-{t.id}"
          aria-selected={t.id === value}
          aria-controls="{id}-p"
          tabindex={t.id === value || (!hasSel && t.id === firstOn) ? 0 : -1}
          disabled={t.disabled}
          class="ctl ctl-ghost shrink-0 disabled:opacity-45"
          onclick={() => select(t)}>{#if t.icon}{@const I = t.icon}<I size={15} class="shrink-0" aria-hidden="true" />{/if}{t.label}</button
        >
      {/if}
    {/each}
  </div>
  {#if panel && value}
    <div class="pt-2 outline-none" id="{id}-p" role="tabpanel" aria-labelledby="{id}-t-{value}" tabindex="-1">{@render panel(value)}</div>
  {/if}
</div>

