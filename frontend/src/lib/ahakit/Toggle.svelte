<script lang="ts">
  import type { Snippet } from 'svelte';
  import { uid } from './util';

  type Props = {
    checked?: boolean;
    label?: string;
    title?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
    hideLabel?: boolean;
    id?: string;
    onchange?: (checked: boolean) => void;
    children?: Snippet;
  };
  let { checked = $bindable(false), label, title, disabled = false, size = 'md', hideLabel = false, id = uid('tg'), onchange, children }: Props = $props();

  function toggle() {
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button type="button" role="switch" class="ui-toggle {size}" {id} {title} {disabled} aria-checked={checked} aria-label={hideLabel || children ? label : undefined} onclick={toggle}>
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  {#if children}{@render children()}{:else if label && !hideLabel}<span class="text">{label}</span>{/if}
</button>

<style>
  .ui-toggle {
    --thumb-scale: 1;
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--size-control);
    max-width: 100%;
    min-width: 0;
    padding: 0;
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    background: none;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    text-align: left;
  }
  .ui-toggle:focus-visible {
    outline: none;
  }
  .ui-toggle:focus-visible .track {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
  .ui-toggle:disabled {
    opacity: var(--opacity-disabled);
    cursor: not-allowed;
  }
  .track {
    position: relative;
    flex: none;
    width: var(--size-toggle-w);
    height: var(--size-toggle-h);
    box-sizing: border-box;
    border-radius: var(--radius-full);
    border: 1px solid var(--color-toggle-border);
    background: var(--color-toggle-off);
    background-clip: padding-box;
    transition: background-color var(--motion-fast), border-color var(--motion-fast);
  }
  .thumb {
    position: absolute;
    z-index: 1;
    top: 1px;
    left: 1px;
    width: calc(var(--size-toggle-h) - 4px);
    height: calc(var(--size-toggle-h) - 4px);
    border-radius: var(--radius-full);
    background: var(--color-toggle-thumb);
    box-shadow: var(--shadow-toggle-thumb);
    transform: scale(var(--thumb-scale));
    transition: transform var(--motion-fast), background-color var(--motion-fast), width var(--motion-fast);
  }
  .track::after {
    content: "";
    position: absolute;
    z-index: 0;
    top: 1px;
    left: 1px;
    width: calc(var(--size-toggle-h) - 4px);
    height: calc(var(--size-toggle-h) - 4px);
    border-radius: 50%;
    background: var(--color-halo);
    opacity: 0;
    pointer-events: none;
    transform-origin: center;
    transform: scale(0.6);
    transition: transform var(--motion-fast), opacity var(--motion-fast);
  }
  .ui-toggle:hover:not(:disabled) {
    --thumb-scale: 1.15;
  }
  .ui-toggle:hover:not(:disabled) .thumb {
    background: var(--color-toggle-thumb-hover);
  }
  .ui-toggle[aria-checked='true'] .track {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
  .ui-toggle[aria-checked='true'] .track::after {
    transform: translateX(calc(var(--size-toggle-w) - var(--size-toggle-h))) scale(0.6);
  }
  .ui-toggle[aria-checked='true']:hover:not(:disabled) .thumb,
  .ui-toggle[aria-checked='true'] .thumb {
    background: var(--color-on-accent);
    transform: translateX(calc(var(--size-toggle-w) - var(--size-toggle-h))) scale(var(--thumb-scale));
  }
  .ui-toggle:active:not(:disabled) .thumb {
    width: calc(var(--size-toggle-h) - 1px);
  }
  .ui-toggle:active:not(:disabled):not([aria-checked='true']) .track::after {
    opacity: 1;
    transform: scale(calc((var(--size-thumb) + 12px) / (var(--size-toggle-h) - 4px) * var(--thumb-scale)));
  }
  .ui-toggle[aria-checked='true']:active:not(:disabled) .thumb {
    transform: translateX(calc(var(--size-toggle-w) - var(--size-toggle-h) - 3px)) scale(var(--thumb-scale));
  }
  .ui-toggle[aria-checked='true']:active:not(:disabled) .track::after {
    opacity: 1;
    transform: translateX(calc(var(--size-toggle-w) - var(--size-toggle-h))) scale(calc((var(--size-thumb) + 12px) / (var(--size-toggle-h) - 4px) * var(--thumb-scale)));
  }
  .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (forced-colors: active) {
    .track, .thumb { forced-color-adjust: none; }
    .track { background: Canvas; border-color: ButtonText; }
    .thumb, .ui-toggle:hover:not(:disabled) .thumb { background: ButtonText; box-shadow: none; }
    .ui-toggle[aria-checked='true'] .track { background: Highlight; border-color: Highlight; }
    .ui-toggle[aria-checked='true'] .thumb, .ui-toggle[aria-checked='true']:hover:not(:disabled) .thumb { background: HighlightText; }
    .ui-toggle:disabled .track { border-color: GrayText; }
    .ui-toggle:disabled .thumb { background: GrayText; }
    .track::after { display: none; }
  }
</style>
