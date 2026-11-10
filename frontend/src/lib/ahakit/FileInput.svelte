<script lang="ts">
  import type { Snippet } from 'svelte';
  import Upload from '@lucide/svelte/icons/upload';

  type Props = {
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
    label?: string;
    hint?: string;
    title?: string;
    compact?: boolean;
    onfiles?: (files: File[]) => void;
    children?: Snippet;
  };
  let { accept, multiple = false, disabled = false, label = 'Drop files or click to browse', hint, title, compact = false, onfiles, children }: Props = $props();
  let input: HTMLInputElement | undefined = $state();
  let over = $state(false);
  let depth = 0;

  function ok(f: File) {
    if (!accept) return true;
    return accept.split(',').some((a) => {
      a = a.trim().toLowerCase();
      return a.startsWith('.') ? f.name.toLowerCase().endsWith(a) : a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : f.type === a;
    });
  }
  function emit(list: FileList | null | undefined) {
    let files = Array.from(list ?? []).filter(ok);
    if (!multiple) files = files.slice(0, 1);
    if (files.length) onfiles?.(files);
  }
  function drag(e: DragEvent, d: number) {
    if (disabled || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    depth = Math.max(0, depth + d);
    over = depth > 0;
  }
</script>

<div
  class="ui-drop"
  class:compact
  class:over
  class:disabled
  role="button"
  tabindex={disabled ? -1 : 0}
  aria-disabled={disabled || undefined}
  aria-label={label}
  {title}
  onclick={() => !disabled && input?.click()}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && (e.preventDefault(), input?.click())}
  ondragenter={(e) => drag(e, 1)}
  ondragleave={(e) => drag(e, -1)}
  ondragover={(e) => drag(e, 0)}
  ondrop={(e) => {
    if (disabled) return;
    e.preventDefault();
    depth = 0;
    over = false;
    emit(e.dataTransfer?.files);
  }}
>
  {#if children}{@render children()}{:else}
    <Upload size={15} class="shrink-0" aria-hidden="true" />
    <span class="label">{label}</span>
    {#if hint && !compact}<span class="hint">{hint}</span>{/if}
  {/if}
  <input bind:this={input} type="file" {accept} {multiple} {disabled} tabindex="-1" aria-hidden="true" onchange={(e) => (emit(e.currentTarget.files), (e.currentTarget.value = ''))} />
</div>

<style>
  .ui-drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-6);
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    text-align: center;
    background: var(--color-control);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color var(--motion-fast), color var(--motion-fast);
  }
  .compact {
    flex-direction: row;
    min-height: var(--size-control);
    padding: 0 var(--space-4);
  }
  .ui-drop:hover:not(.disabled),
  .over {
    background: var(--color-control-hover);
    color: var(--color-text);
  }
  .over {
    background: var(--color-control-active);
  }
  .ui-drop:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
  }
  .disabled {
    opacity: var(--opacity-disabled);
    cursor: not-allowed;
  }
  .hint {
    font-size: var(--text-small);
  }
  input {
    display: none;
  }
</style>
