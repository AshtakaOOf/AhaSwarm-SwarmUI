<script lang="ts">
  import CopyButton from './CopyButton.svelte';
  import Toggle from './Toggle.svelte';
  import { ansiSegments, stripAnsi } from './ansi';

  export type LogRow = { t: string; type: string; color?: string; msg: string };
  type Props = { lines?: string[]; rows?: LogRow[]; text?: string; autoscroll?: boolean; wrap?: boolean; height?: string; label?: string };
  let { lines, rows, text, autoscroll = $bindable(true), wrap = false, height = '240px', label = 'Log' }: Props = $props();
  let box: HTMLElement | undefined = $state();
  const body = $derived(text ?? (rows ? rows.map(r => `[${r.t}] [${r.type}] ${stripAnsi(r.msg)}`).join('\n') : (lines ?? []).join('\n')));

  $effect(() => {
    void body;
    if (autoscroll && box) box.scrollTop = box.scrollHeight;
  });
  function scrolled() {
    if (!box) return;
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 8;
    if (!atEnd && autoscroll) autoscroll = false;
  }
</script>

<div class="ui-log">
  <div class="bar">
    <span class="title">{label}</span>
    <Toggle bind:checked={autoscroll} label="Autoscroll" size="sm" />
    <CopyButton text={() => body} label="Copy log" />
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div bind:this={box} class="body" class:wrap style:height role="log" aria-label={label} tabindex="0" onscroll={scrolled}>
    {#if rows}
      {#each rows as row, i (i)}
        <div class="line"><span>{row.t} [</span><span class="lvl" style:color={row.color}>{row.type}</span><span>] </span>{#each ansiSegments(row.msg) as seg, j (j)}{#if seg.color}<span style:color={seg.color}>{seg.text}</span>{:else}{seg.text}{/if}{/each}</div>
      {/each}
    {:else}
      {body}
    {/if}
  </div>
</div>

<style>
  .ui-log {
    min-width: 0;
    font-family: var(--font-sans);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-0) var(--space-0) 0 var(--space-4);
  }
  .title {
    flex: 1;
    font-size: var(--font-size-label);
    color: var(--color-text-muted);
  }
  .body {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    overflow: auto;
    white-space: pre;
    font-family: var(--font-mono);
    font-size: var(--font-size-label);
    line-height: var(--line-height);
    color: var(--color-text);
  }
  .body:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
  }
  .wrap {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
