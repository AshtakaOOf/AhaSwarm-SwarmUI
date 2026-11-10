<script lang="ts">
  type Props = { value?: number | null; max?: number; label?: string; ariaLabel?: string; hideLabel?: boolean; title?: string; showValue?: boolean; detail?: string };
  let { value = null, max = 1, label, ariaLabel, hideLabel = false, title, showValue = false, detail }: Props = $props();
  const pct = $derived(value == null ? null : Math.round(Math.min(100, Math.max(0, (value / max) * 100))));
</script>

<div class="ui-progress" {title}>
  {#if (label && !hideLabel) || showValue || detail}
    <div class="meta"><span class="lbl" title={label}>{hideLabel ? '' : (label ?? '')}</span>{#if detail}<span class="detail">{detail}</span>{/if}{#if showValue && pct != null}<span class="pct">{pct}%</span>{/if}</div>
  {/if}
  <div
    class="track"
    class:indeterminate={pct == null}
    role="progressbar"
    aria-label={ariaLabel ?? label ?? title}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={pct ?? undefined}
  >
    <div class="fill" style={pct == null ? undefined : `width:${pct}%`}></div>
  </div>
</div>

<style>
  .ui-progress {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-family: var(--font-sans);
    font-size: var(--font-size-label);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
  }
  .meta {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .lbl { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-ink-2); }
  .detail { flex: none; white-space: nowrap; }
  .pct { flex: none; min-width: 4ch; text-align: right; color: var(--color-ink); }
  .track {
    position: relative;
    height: var(--size-progress);
    overflow: hidden;
    background: var(--color-progress-track, var(--color-raised));
    border-radius: var(--radius-sm);
  }
  .fill {
    height: 100%;
    background: var(--color-progress);
    transition: width var(--motion-base);
  }
  .indeterminate .fill {
    width: 35%;
    animation: ui-indet 1.2s ease-in-out infinite;
  }
  @keyframes ui-indet {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(300%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .indeterminate .fill {
      width: 100%;
      animation: none;
      opacity: var(--opacity-disabled);
    }
  }
  @media (forced-colors: active) {
    .track { outline: 1px solid CanvasText; outline-offset: -1px; }
    .fill { forced-color-adjust: none; background: Highlight; }
  }
</style>
