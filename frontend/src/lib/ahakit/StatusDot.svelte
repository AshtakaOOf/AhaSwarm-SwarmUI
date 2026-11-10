<script lang="ts">
  import type { Status } from './types';

  let { status = 'idle', label, showLabel = false, title }: { status?: Status; label?: string; showLabel?: boolean; title?: string } = $props();
  const text = $derived(label ?? status);
</script>

<span class="ui-dot {status}" {title}>
  <span class="dot" aria-hidden="true"></span>
  {#if showLabel}<span class="label">{text}</span>{:else}<span class="sr">{text}</span>{/if}
</span>

<style>
  .ui-dot {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-width: 0;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-size: var(--text-small);
    color: var(--color-ink-2);
  }
  .dot {
    position: relative;
    flex: none;
    width: var(--size-dot);
    height: var(--size-dot);
    border-radius: var(--radius-full);
    background: var(--color-text-subtle);
  }
  .queued .dot {
    background: var(--color-info);
  }
  .running .dot {
    background: var(--color-warning);
  }
  .running .dot::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background: inherit;
    animation: ui-ping 1.2s ease-out infinite;
  }
  .success .dot {
    background: var(--color-success);
  }
  .warning .dot {
    background: var(--color-warning);
  }
  .error .dot {
    background: var(--color-danger-text);
  }
  .offline .dot {
    background: var(--color-control-raised-active);
  }
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  @keyframes ui-ping {
    to {
      transform: scale(2.2);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .running .dot::after {
      animation: none;
    }
  }
  @media (forced-colors: active) {
    .dot { forced-color-adjust: none; }
  }
</style>
