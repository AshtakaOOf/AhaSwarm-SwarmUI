<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import X from '@lucide/svelte/icons/x';
  import Field from './Field.svelte';
  import { uid } from './util';

  type Props = Omit<HTMLInputAttributes, 'value' | 'oninput' | 'onchange'> & {
    value?: string;
    label?: string;
    hint?: string;
    invalid?: boolean;
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
    ref?: HTMLInputElement;
  };
  let { value = $bindable(''), label, hint, title, invalid = false, id = uid('in'), type = 'text', class: cls = '', disabled = false, oninput, onchange, ref = $bindable(), ...rest }: Props = $props();

  function clear() {
    value = '';
    oninput?.('');
    ref?.focus();
  }
</script>

{#snippet control()}
  <input
    {...rest}
    bind:this={ref}
    {id}
    {type}
    {title}
    {disabled}
    class="ctl ctl-field w-full min-w-0 justify-start text-left placeholder:text-ink-3 hover:bg-hover focus:bg-hover disabled:opacity-45 aria-[invalid=true]:bg-[var(--color-danger-soft)] aria-[invalid=true]:text-[#e48c8c] {cls}"
    aria-invalid={invalid || undefined}
    bind:value
    oninput={() => oninput?.(value)}
    onchange={() => onchange?.(value)}
  />
{/snippet}

<Field {label} {hint} {title} forId={id}>
  {#if type === 'search'}
    <div class="search">
      {@render control()}
      {#if value && !disabled}
        <button type="button" class="x" aria-label="Clear" title="Clear" onmousedown={(e) => e.preventDefault()} onclick={clear}><X size={15} aria-hidden="true" /></button>
      {/if}
    </div>
  {:else}
    {@render control()}
  {/if}
</Field>

<style>
  .search { position: relative; width: 100%; min-width: 0; }
  .search input { padding-right: 30px; }
  .x { position: absolute; top: 50%; right: 4px; translate: 0 -50%; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: 0; background: transparent; border-radius: var(--radius-sm); color: var(--color-ink-2); line-height: 0; cursor: pointer; }
  .x:hover, .x:focus-visible { background: var(--color-active); color: var(--color-ink); }
  .x:active { background: var(--color-active); }
</style>

