<script lang="ts">
  import Field from './Field.svelte';
  import NumberInput from './NumberInput.svelte';
  import { clamp, fitNumber, uid } from './util';

  type Props = {
    value?: number;
    min?: number;
    max?: number;
    viewMin?: number;
    viewMax?: number;
    scale?: 'linear' | 'pot';
    step?: number;
    label?: string;
    info?: string;
    hint?: string;
    title?: string;
    disabled?: boolean;
    defaultValue?: number;
    steppers?: boolean;
    id?: string;
    number?: boolean;
    buffered?: number;
    ariaLabel?: string;
    valueText?: string;
    oninput?: (value: number) => void;
    onchange?: (value: number) => void;
  };
  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    viewMin,
    viewMax,
    scale = 'linear',
    step = 1,
    label,
    info,
    hint,
    title,
    disabled = false,
    defaultValue,
    steppers = true,
    id = uid('sl'),
    number = true,
    buffered,
    ariaLabel,
    valueText,
    oninput,
    onchange,
  }: Props = $props();

  const pot = $derived(scale === 'pot');
  const lo = $derived(viewMin ?? min);
  const hi = $derived(Math.max(viewMax ?? max, lo));
  function potToLinear(v: number, mx: number, mn: number) {
    const inc = Math.log2(mx), dis = mn === 0 ? 0 : Math.log2(mn);
    return Math.round(((Math.log2(Math.max(v, 1e-9)) - dis) / (inc - dis)) * mx);
  }
  function linearToPot(v: number, mx: number, mn: number, st: number) {
    if (v < mn + st) return mn;
    const inc = Math.log2(mx), dis = mn === 0 ? 0 : Math.log2(mn);
    const n = (v / mx) * (inc - dis) + dis;
    const a = Math.floor(n), b = Math.ceil(n), ra = Math.round(2 ** a), rb = Math.round(2 ** b);
    if (ra === rb) return ra;
    let count = 9999;
    st /= 2;
    while (count > 4) {
      st *= 2;
      count = Math.round((rb - ra) / st);
      if (count <= 1) return 2 ** Math.round(n);
    }
    return ra + Math.round(((n - a) / (b - a)) * count) * st;
  }
  const rMin = $derived(lo);
  const rMax = $derived(hi);
  const rStep = $derived(step || 1);
  const stepDecimals = $derived((String(step).split('.')[1] ?? '').length);
  const numChars = $derived(Math.max(
    2,
    String(Math.trunc(Math.abs(lo))).length + (lo < 0 ? 1 : 0) + (stepDecimals ? stepDecimals + 1 : 0),
    String(Math.trunc(Math.abs(hi))).length + (hi < 0 ? 1 : 0) + (stepDecimals ? stepDecimals + 1 : 0),
  ));
  const numWidth = $derived(`calc(${numChars}ch + 16px + ${steppers ? 'var(--size-stepper)' : '0px'})`);
  const pos = $derived(clamp(pot ? potToLinear(value, hi, lo) : value, rMin, rMax));
  const pct = $derived(rMax > rMin ? ((pos - rMin) / (rMax - rMin)) * 100 : 0);

  function fromRange(e: Event & { currentTarget: HTMLInputElement }) {
    const p = +e.currentTarget.value;
    value = fitNumber(pot ? linearToPot(p, hi, lo, step || 1) : p, step, min, max);
    oninput?.(value);
  }
  function reset() {
    if (defaultValue === undefined || disabled) return;
    value = defaultValue;
    onchange?.(value);
  }
</script>

<Field {label} {info} {hint} {title} forId={id} onreset={defaultValue !== undefined ? reset : undefined}>
  <div class="ui-slider" class:disabled class:bare={!number} style="--pct: {pct}%; --buf: {Math.max(pct, buffered ?? 0)}%" {title}>
    <input
      class="range"
      type="range"
      min={rMin}
      max={rMax}
      step={rStep}
      value={pos}
      {disabled}
      aria-label={ariaLabel ?? label}
      aria-valuetext={valueText ?? String(value)}
      oninput={fromRange}
      onchange={() => onchange?.(value)}
      ondblclick={reset}
    />
    {#if number}<div class="num" class:steppers style="width: {numWidth}"><NumberInput bind:value {id} {min} {max} {step} {disabled} {defaultValue} {steppers} wheel {oninput} {onchange} /></div>{/if}
  </div>
</Field>

<style>
  .ui-slider {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .disabled {
    opacity: var(--opacity-disabled);
  }
  .range {
    --slider-halo-room: 6px;
    flex: 1;
    /* never collapses to a dot: below this the row stacks (param panel container query) */
    min-width: 80px;
    height: var(--size-control);
    box-sizing: content-box;
    padding: 0 var(--slider-halo-room);
    margin: 0 calc(-1 * var(--slider-halo-room));
    background: transparent;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    touch-action: pan-y;
  }
  .range:active:not(:disabled) { position: relative; z-index: 1; }
  .range:disabled {
    cursor: not-allowed;
  }
  .range:focus {
    outline: none;
  }
  .range:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
    border-radius: var(--radius-md);
  }
  .range::-webkit-slider-runnable-track {
    height: var(--size-track);
    border-radius: var(--radius-full);
    background: linear-gradient(to right, var(--color-accent) var(--pct), var(--color-track-buffered, color-mix(in srgb, var(--color-ink) 35%, var(--color-track))) var(--pct) var(--buf), var(--color-track) var(--buf));
  }
  .range::-moz-range-track {
    height: var(--size-track);
    border-radius: var(--radius-full);
    background: linear-gradient(to right, var(--color-track-buffered, color-mix(in srgb, var(--color-ink) 35%, var(--color-track))) var(--buf), var(--color-track) var(--buf));
  }
  .range::-moz-range-progress {
    height: var(--size-track);
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }
  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: var(--size-thumb);
    height: var(--size-thumb);
    margin-top: calc((var(--size-track) - var(--size-thumb)) / 2);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--color-accent);
    box-shadow: none;
    transition: transform var(--motion-fast);
  }
  .range::-moz-range-thumb {
    width: var(--size-thumb);
    height: var(--size-thumb);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--color-accent);
    box-shadow: none;
  }
  .range:hover:not(:disabled)::-webkit-slider-thumb {
    transform: scale(1.15);
  }
  .range:active:not(:disabled)::-webkit-slider-thumb {
    transform: scale(1.15);
    box-shadow: 0 0 0 4px var(--color-halo);
  }
  .range:active:not(:disabled)::-moz-range-thumb {
    transform: scale(1.15);
    box-shadow: 0 0 0 4px var(--color-halo);
  }
  .range::-webkit-slider-thumb { transition: transform var(--motion-fast), box-shadow var(--motion-fast); }
  .bare .range { min-width: 0; }
  .bare { flex: 1; }
  .num {
    flex: none;
    font-size: var(--font-size-input);
  }
  @media (forced-colors: active) {
    .range { forced-color-adjust: none; }
    .range::-webkit-slider-runnable-track { background: linear-gradient(to right, Highlight var(--pct), ButtonText var(--pct)); }
    .range::-moz-range-track { background: ButtonText; }
    .range::-moz-range-progress { background: Highlight; }
    .range::-webkit-slider-thumb { background: Highlight; box-shadow: 0 0 0 2px Canvas; }
    .range::-moz-range-thumb { background: Highlight; box-shadow: 0 0 0 2px Canvas; }
    .range:disabled::-webkit-slider-runnable-track { background: GrayText; }
    .range:disabled::-webkit-slider-thumb { background: GrayText; }
    .range:disabled::-moz-range-thumb { background: GrayText; }
  }
</style>
