<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Folder from '@lucide/svelte/icons/folder';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import File from '@lucide/svelte/icons/file';
  import { uid } from './util';
  import type { TreeItem } from './types';

  type Key = TreeItem['id'];
  type Row = { it: TreeItem; depth: number; parent?: Key; pos: number; size: number; kids?: TreeItem[]; branch: boolean };
  type Props = {
    items: TreeItem[];
    selected?: Key;
    expanded?: Key[];
    label: string;
    followFocus?: boolean;
    id?: string;
    loadChildren?: (item: TreeItem) => Promise<TreeItem[]>;
    item?: Snippet<[TreeItem, { expanded: boolean; selected: boolean; depth: number }]>;
    onselect?: (item: TreeItem) => void;
    onexpand?: (item: TreeItem, expanded: boolean) => void;
    onactivate?: (item: TreeItem) => void;
  };
  let { items, selected = $bindable(), expanded = $bindable([]), label, followFocus = false, id = uid('tree'), loadChildren, item, onselect, onexpand, onactivate }: Props = $props();

  let focused = $state<Key | undefined>();
  let loaded = $state<Record<string, TreeItem[]>>({});
  let loading = $state<Record<string, boolean>>({});
  let el: HTMLUListElement | undefined = $state();

  const rows = $derived.by(() => {
    const out: Row[] = [];
    const walk = (list: TreeItem[], depth: number, parent?: Key) =>
      list.forEach((it, i) => {
        const kids = it.children ?? loaded[it.id];
        const branch = !!(kids?.length || (it.lazy && !kids));
        out.push({ it, depth, parent, pos: i + 1, size: list.length, kids, branch });
        if (branch && expanded.includes(it.id) && kids) walk(kids, depth + 1, it.id);
      });
    walk(items, 0);
    return out;
  });
  const tabKey = $derived(rows.some((r) => r.it.id === focused) ? focused : rows.some((r) => r.it.id === selected) ? selected : rows[0]?.it.id);
  const rid = (k: Key) => `${id}-${k}`;

  async function toggle(r: Row, open = !expanded.includes(r.it.id)) {
    if (!r.branch || open === expanded.includes(r.it.id)) return;
    expanded = open ? [...expanded, r.it.id] : expanded.filter((k) => k !== r.it.id);
    onexpand?.(r.it, open);
    if (open && r.it.lazy && !r.kids && loadChildren && !loading[r.it.id]) {
      loading[r.it.id] = true;
      try {
        loaded[r.it.id] = await loadChildren(r.it);
      } finally {
        loading[r.it.id] = false;
      }
    }
  }
  function select(r: Row) {
    if (r.it.disabled) return;
    selected = r.it.id;
    onselect?.(r.it);
  }
  function focus(k: Key | undefined) {
    if (k === undefined) return;
    focused = k;
    document.getElementById(rid(k))?.focus();
    const r = rows.find((x) => x.it.id === k);
    if (followFocus && r) select(r);
  }
  function key(e: KeyboardEvent, i: number) {
    const r = rows[i];
    const k = e.key;
    if (k === 'ArrowDown') focus(rows[i + 1]?.it.id);
    else if (k === 'ArrowUp') focus(rows[i - 1]?.it.id);
    else if (k === 'Home') focus(rows[0]?.it.id);
    else if (k === 'End') focus(rows[rows.length - 1]?.it.id);
    else if (k === 'ArrowRight') {
      if (r.branch && !expanded.includes(r.it.id)) toggle(r, true);
      else if (r.branch && rows[i + 1]?.parent === r.it.id) focus(rows[i + 1].it.id);
    } else if (k === 'ArrowLeft') {
      if (r.branch && expanded.includes(r.it.id)) toggle(r, false);
      else focus(r.parent);
    } else if (k === 'Enter' || k === ' ') {
      select(r);
      if (k === 'Enter') onactivate?.(r.it);
    } else if (k === '*') rows.filter((x) => x.parent === r.parent).forEach((x) => toggle(x, true));
    else if (k.length === 1 && /\S/.test(k)) {
      const after = [...rows.slice(i + 1), ...rows.slice(0, i)];
      focus(after.find((x) => x.it.label.toLowerCase().startsWith(k.toLowerCase()))?.it.id);
    } else return;
    e.preventDefault();
  }
</script>

<ul bind:this={el} class="ui-tree" role="tree" aria-label={label}>
  {#each rows as r, i (r.it.id)}
    {@const open = r.branch && expanded.includes(r.it.id)}
    {@const sel = r.it.id === selected}
    <li
      id={rid(r.it.id)}
      role="treeitem"
      class:sel
      aria-level={r.depth + 1}
      aria-setsize={r.size}
      aria-posinset={r.pos}
      aria-expanded={r.branch ? open : undefined}
      aria-selected={sel}
      aria-disabled={r.it.disabled || undefined}
      aria-busy={loading[r.it.id] || undefined}
      tabindex={r.it.id === tabKey ? 0 : -1}
      style="--d: {r.depth}"
      onkeydown={(e) => key(e, i)}
      onfocus={() => (focused = r.it.id)}
      onclick={() => select(r)}
      ondblclick={() => (r.branch ? toggle(r) : onactivate?.(r.it))}
    >
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <span class="tw" class:open class:leaf={!r.branch} onclick={(e) => (e.stopPropagation(), toggle(r))}>{#if r.branch}<ChevronRight size={14} aria-hidden="true" />{/if}</span>
      {#if item}{@render item(r.it, { expanded: open, selected: sel, depth: r.depth })}{:else}
        {@const I = r.it.icon ?? (r.branch ? (open ? FolderOpen : Folder) : File)}<I size={15} class="ti" aria-hidden="true" />
        <span class="text">{r.it.label}</span>
        {#if r.it.count !== undefined}<span class="count tabular-nums">{r.it.count}</span>{/if}
        {#if loading[r.it.id]}<span class="busy">Loading…</span>{/if}
      {/if}
    </li>
  {/each}
</ul>

<style>
  .ui-tree {
    --indent: 12px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-sans);
    font-size: var(--text-ui);
    color: var(--color-ink-2);
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--spacing-ctl-dense, 24px);
    padding: 0 var(--space-2) 0 calc(var(--d) * var(--indent) + 2px);
    border-radius: var(--radius-sm);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    outline: none;
    transition: background-color var(--motion-fast), color var(--motion-fast);
  }
  li:hover {
    background-color: var(--color-hover);
    color: var(--color-ink);
  }
  li.sel,
  li.sel:hover {
    background-color: var(--color-active);
    color: var(--color-ink);
  }
  li.sel > :global(.ti),
  li.sel .tw {
    color: var(--color-ink-2);
  }
  li:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--color-ring);
  }
  li[aria-disabled='true'] {
    opacity: var(--opacity-disabled);
    cursor: not-allowed;
  }
  li > :global(.ti) {
    flex: none;
    color: var(--color-ink-3);
  }
  .count {
    margin-left: auto;
    padding-left: var(--space-2);
    font-size: var(--text-small);
    color: var(--color-ink-3);
  }
  .tw {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 100%;
    color: var(--color-ink-3);
  }
  .tw :global(svg) {
    transition: transform var(--motion-fast);
  }
  .tw.open :global(svg) {
    transform: rotate(90deg);
  }
  .text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .busy {
    font-size: var(--text-small);
    color: var(--color-text-subtle);
  }
  @media (pointer: coarse) {
    .ui-tree {
      --indent: 16px;
    }
    li {
      height: var(--spacing-ctl, 32px);
    }
  }
</style>
