<script lang="ts">
  import CopyButton from './CopyButton.svelte';
  import Toggle from './Toggle.svelte';

  type Props = { lines?: string[]; text?: string; autoscroll?: boolean; wrap?: boolean; height?: string; label?: string };
  let { lines, text, autoscroll = $bindable(true), wrap = false, height = '240px', label = 'Log' }: Props = $props();
  let box: HTMLPreElement | undefined = $state();
  const body = $derived(text ?? (lines ?? []).join('\n'));

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
  <pre bind:this={box} class:wrap style:height role="log" aria-label={label} tabindex="0" onscroll={scrolled}>{body}</pre>
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
  pre {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    overflow: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-label);
    line-height: var(--line-height);
    color: var(--color-text);
  }
  pre:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
  }
  .wrap {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
