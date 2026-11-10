<script lang="ts">
  import CopyButton from './CopyButton.svelte';

  let { code, language, wrap = false, copy = true, maxHeight }: { code: string; language?: string; wrap?: boolean; copy?: boolean; maxHeight?: string } = $props();
</script>

<div class="ui-code">
  {#if language || copy}
    <div class="bar">
      <span class="lang">{language ?? ''}</span>
      {#if copy}<CopyButton text={code} label="Copy code" />{/if}
    </div>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre class:wrap style:max-height={maxHeight} tabindex="0"><code>{code}</code></pre>
</div>

<style>
  .ui-code {
    position: relative;
    min-width: 0;
    font-family: var(--font-sans);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-0) var(--space-0) 0 var(--space-4);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }
  pre {
    margin: 0;
    padding: var(--space-2) var(--space-4) var(--space-3);
    overflow: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-label);
    line-height: var(--line-height);
    color: var(--color-text);
    tab-size: 2;
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
