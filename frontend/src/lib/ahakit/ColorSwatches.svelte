<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import Pipette from '@lucide/svelte/icons/pipette';
  import { accentTokens, uid } from './util';

  type Swatch = { value: string; label: string; color?: string };
  let { value = $bindable(''), options, label, custom = true, recent = '', onchange, id = uid('sw') }:
    { value?: string; options: Swatch[]; label: string; custom?: boolean; recent?: string; onchange?: (v: string) => void; id?: string } = $props();
  const inOptions = (v: string) => options.some((o) => o.value.toLowerCase() === v.toLowerCase());
  const showRecent = $derived(custom && !!recent && !inOptions(recent));
  const isRecent = $derived(showRecent && value.toLowerCase() === recent.toLowerCase());
  const isCustom = $derived(!!value && !inOptions(value) && !isRecent);
  function pick(v: string) { value = v; onchange?.(v); }
  const ink = (c: string) => accentTokens(c)?.['--color-on-accent'] ?? '#fff';
</script>

<div class="ui-swatches" role="radiogroup" aria-label={label} {id}>
  {#each options as o (o.value)}
    {@const c = o.color ?? o.value}
    {@const on = value.toLowerCase() === o.value.toLowerCase()}
    <button type="button" role="radio" aria-checked={on} aria-label={o.label} title={o.label} class="sw" class:on
      style:--sw={c || 'var(--color-accent-default, var(--color-accent))'} style:color={c ? ink(c) : 'var(--color-on-accent-default, var(--color-on-accent))'} onclick={() => pick(o.value)}>
      {#if on}<Check size={13} strokeWidth={3} aria-hidden="true" />{/if}
    </button>
  {/each}
  {#if showRecent}
    <button type="button" role="radio" aria-checked={isRecent} aria-label="Custom {recent}" title="Custom {recent}" class="sw" class:on={isRecent}
      style:--sw={recent} style:color={ink(recent)} onclick={() => pick(recent)}>
      {#if isRecent}<Check size={13} strokeWidth={3} aria-hidden="true" />{/if}
    </button>
  {/if}
  {#if custom}
    <label class="sw well" class:on={isCustom} title="Custom colour" style:--sw={isCustom ? value : 'transparent'} style:color={isCustom ? ink(value) : undefined}>
      <input type="color" aria-label="Custom colour" value={isCustom ? value : showRecent ? recent : '#3584e4'} onchange={(e) => pick((e.currentTarget as HTMLInputElement).value)} />
      {#if isCustom}<Check size={13} strokeWidth={3} aria-hidden="true" />{:else}<Pipette size={13} aria-hidden="true" />{/if}
    </label>
  {/if}
</div>

<style>
  /* padding = the selected ring's reach (2px gap + 2px ring), so it never clips at a row or container edge */
  .ui-swatches { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px; max-width: 100%; box-sizing: border-box; }
  .sw { flex: none; }
  .sw { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0;
    border-radius: var(--radius-full, 999px); background: var(--sw); background-clip: padding-box; cursor: pointer; }
  .sw.on { outline: 2px solid var(--color-ink-2); outline-offset: 2px; }
  .sw:focus-visible, .well:focus-within { outline: var(--focus-ring); outline-offset: 2px; }
  .well { background: var(--sw); color: var(--color-ink-2); }
  .well:not(.on) { background: conic-gradient(#e01b24, #e5a50a, #2ec27e, #3584e4, #9141ac, #e01b24); color: #fff; }
  .well input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }
  @media (forced-colors: active) {
    .sw { forced-color-adjust: none; }
    .sw.on { outline-color: Highlight; }
  }
</style>
