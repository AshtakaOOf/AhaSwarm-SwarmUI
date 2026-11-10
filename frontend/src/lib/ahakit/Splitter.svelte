<script lang="ts">
  import type { Snippet } from 'svelte';
  import SplitHandle from './SplitHandle.svelte';
  import { uid } from './util';

  type Props = {
    direction?: 'horizontal' | 'vertical';
    size?: number;
    collapsed?: boolean;
    min?: number;
    dragFloor?: number;
    collapseTo?: number;
    paneOverflow?: 'auto' | 'hidden';
    max?: number;
    defaultSize?: number;
    unit?: 'px' | '%';
    step?: number;
    reverse?: boolean;
    collapsible?: boolean;
    persistKey?: string;
    label?: string;
    class?: string;
    onresize?: (size: number) => void;
    oncollapse?: (collapsed: boolean) => void;
    avoid?: string;
    preview?: number | null;
    first: Snippet;
    second: Snippet;
  };
  let {
    direction = 'horizontal',
    size = $bindable(),
    collapsed = $bindable(false),
    min = 0,
    dragFloor = 0,
    collapseTo,
    paneOverflow = 'auto',
    max = Infinity,
    defaultSize,
    unit = 'px',
    step,
    reverse = false,
    collapsible = false,
    persistKey,
    label,
    class: cls = '',
    onresize,
    oncollapse,
    avoid,
    preview = $bindable(null),
    first,
    second,
  }: Props = $props();

  const id = uid('pane');
  let animating = $state(false);
  const collapseSize = $derived(collapseTo ?? 0);
  // a pane that collapses to a persistent strip never shrinks below it, even if the stored size is smaller
  const open = $derived(collapseTo === undefined
    ? size ?? defaultSize ?? min
    : Math.max(size ?? defaultSize ?? min, min, collapseSize));
  const basis = $derived(preview !== null ? `${preview}${unit}` : collapsed ? `${collapseSize}${unit}` : `${open}${unit}`);
  const hide = $derived(collapsed && preview === null && collapseTo === undefined);
</script>

<div class="ui-splitter {direction} {cls}">
  <div class="pane" class:sized={!reverse} class:fill={reverse} id={reverse ? undefined : id} class:anim={animating} style:flex-basis={reverse ? undefined : basis} style:overflow={paneOverflow} hidden={!reverse && hide}>
    {@render first()}
  </div>
  <SplitHandle bind:size bind:collapsed {direction} {min} {max} {defaultSize} {unit} {step} {reverse} {collapsible} {persistKey} {label} controls={id} {onresize} {oncollapse} {avoid} {dragFloor} collapseTo={collapseSize} bind:preview bind:animating />
  <div class="pane" class:sized={reverse} class:fill={!reverse} id={reverse ? id : undefined} class:anim={animating} style:flex-basis={reverse ? basis : undefined} style:overflow={paneOverflow} hidden={reverse && hide}>
    {@render second()}
  </div>
</div>

<style>
  .ui-splitter {
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .vertical {
    flex-direction: column;
  }
  .pane {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }
  .sized {
    flex: none;
  }
  .fill {
    flex: 1 1 0;
  }
  .pane.sized.anim {
    transition: flex-basis 200ms cubic-bezier(0.2, 0, 0, 1);
  }
  .pane[hidden] {
    display: none;
  }
</style>
