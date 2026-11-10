<script lang="ts">
  import type { Snippet } from 'svelte';
  import { rovingKeys } from './util';

  let { label, orientation = 'horizontal', wrap = true, children }: { label: string; orientation?: 'horizontal' | 'vertical'; wrap?: boolean; children: Snippet } = $props();
  let el: HTMLDivElement | undefined = $state();
  const SEL = 'button, [role="button"], [data-roving]';

  $effect(() => {
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(SEL)).filter((e) => !(e as HTMLButtonElement).disabled);
    items.forEach((e, i) => (e.tabIndex = i === 0 ? 0 : -1));
  });
</script>

<div
  bind:this={el}
  class="ui-toolbar {orientation}"
  class:nowrap={!wrap}
  role="toolbar"
  tabindex="-1"
  aria-label={label}
  aria-orientation={orientation}
  onkeydown={(e) => el && rovingKeys(e, el, SEL, orientation === 'vertical')}
>
  {@render children()}
</div>

<style>
  .ui-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-1);
    outline: none;
  }
  .nowrap {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .nowrap > :global(*) {
    flex: none;
  }
  .vertical {
    flex-direction: column;
    align-items: stretch;
  }
</style>
