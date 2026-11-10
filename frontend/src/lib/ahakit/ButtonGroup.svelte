<script lang="ts">
  import type { Snippet } from 'svelte';
  import { rovingKeys } from './util';

  let { label, toolbar = false, children }: { label?: string; toolbar?: boolean; children: Snippet } = $props();
  let el: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!el || !toolbar) return;
    Array.from(el.querySelectorAll<HTMLElement>('button')).forEach((b, i) => (b.tabIndex = i === 0 ? 0 : -1));
  });
</script>

<div
  bind:this={el}
  class="ui-group-btns"
  role={toolbar ? 'toolbar' : 'group'}
  tabindex="-1"
  aria-label={label}
  onkeydown={(e) => toolbar && el && rovingKeys(e, el, 'button')}
>
  {@render children()}
</div>

<style>
  .ui-group-btns {
    display: inline-flex;
    gap: 1px;
    outline: none;
  }
  .ui-group-btns > :global(*:not(:first-child)),
  .ui-group-btns > :global(*:not(:first-child) > button) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .ui-group-btns > :global(*:not(:last-child)),
  .ui-group-btns > :global(*:not(:last-child) > button) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .ui-group-btns > :global(*:focus-visible) {
    position: relative;
    z-index: 1;
  }
</style>
