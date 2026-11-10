<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ButtonGroup from './ButtonGroup.svelte';
  import Button from './Button.svelte';
  import Menu from './Menu.svelte';
  import type { MenuItem } from './types';

  type Props = Omit<HTMLButtonAttributes, 'children'> & {
    items: MenuItem[];
    menuLabel: string;
    variant?: 'primary' | 'default' | 'tab';
    selected?: boolean;
    contextMenu?: boolean;
    block?: boolean;
    icon?: import('@lucide/svelte').LucideIcon;
    open?: boolean;
    children: Snippet;
  };
  let { items, menuLabel, variant = 'primary', selected = false, contextMenu = false, block = false, icon, open = $bindable(false), class: cls = '', children, ...rest }: Props = $props();
  let menu: ReturnType<typeof Menu> | undefined = $state();
  const bv = $derived(variant === 'tab' ? 'ghost' : variant);
</script>

<span class="ui-split {variant}" class:on={selected} class:block>
  <ButtonGroup label={menuLabel}>
    <Button {...rest} variant={bv} {icon} class="main {cls}"
      oncontextmenu={contextMenu ? (e: MouseEvent) => { e.preventDefault(); menu?.openAt(e.clientX, e.clientY); } : rest.oncontextmenu}>{@render children()}</Button>
    <Menu bind:this={menu} bind:open {items} label={menuLabel}>
      {#snippet trigger(p)}<Button {...p} variant={bv} iconOnly class="chev" aria-label={menuLabel}><ChevronDown size={variant === 'tab' ? 13 : 15} aria-hidden="true" /></Button>{/snippet}
    </Menu>
  </ButtonGroup>
</span>

<style>
  .ui-split { display: inline-flex; min-width: 0; }
  .ui-split :global(.ui-group-btns) { display: flex; width: 100%; }
  .ui-split > :global(.ui-group-btns > :not(button)) { display: flex; }
  .ui-split :global(.chev) { width: 24px; min-width: 24px; padding: 0; display: grid; place-items: center; line-height: 0; }
  .block, .block :global(.main) { flex: 1; }
  .tab :global(.chev) { width: 20px; min-width: 20px; color: var(--color-ink-3); }
  .tab :global(.chev:hover), .tab :global(.chev[aria-expanded='true']) { color: var(--color-ink); }
  .tab:hover :global(.ctl) { background: var(--color-hover); color: var(--color-ink); }
  .tab.on :global(.ctl) { background: var(--color-pressed); color: var(--color-on-pressed); box-shadow: var(--edge-pressed-ghost); }
  .tab.on :global(.ctl:hover) { background: var(--color-pressed-hover); color: var(--color-on-pressed); }
  /* navbar tabs never push down (no press scale) */
  .ui-split.tab :global(.ui-group-btns .ctl:active) { transform: none; }
  .tab.on :global(.ui-group-btns) { gap: 1px; background: transparent; }
</style>
