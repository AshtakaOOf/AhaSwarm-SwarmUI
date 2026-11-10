<script lang="ts">
  import Field from './Field.svelte';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { fitNumber, uid } from './util';

  type Props = {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    steppers?: boolean;
    wheel?: boolean;
    scrub?: boolean;
    label?: string;
    ariaLabel?: string;
    hint?: string;
    title?: string;
    placeholder?: string;
    disabled?: boolean;
    size?: 'xs' | 'sm' | 'md';
    id?: string;
    class?: string;
    oninput?: (value: number) => void;
    onchange?: (value: number) => void;
  };
  let {
    value = $bindable(0),
    min = -Infinity,
    max = Infinity,
    step = 1,
    defaultValue,
    steppers = true,
    wheel = false,
    scrub = false,
    label,
    ariaLabel,
    hint,
    title,
    placeholder,
    disabled = false,
    size = 'md',
    id = uid('num'),
    class: cls = '',
    oninput,
    onchange,
  }: Props = $props();

  let el: HTMLInputElement | undefined = $state();
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  let text = $state('');
  let editing = false;
  const atMin = $derived(Number.isFinite(value) && value <= min);
  const atMax = $derived(Number.isFinite(value) && value >= max);

  $effect(() => {
    const v = value;
    if (!editing) text = Number.isFinite(v) ? String(v) : '';
  });

  function set(v: number, commit: boolean) {
    const n = fitNumber(v, step, min, max);
    const changed = n !== value;
    value = n;
    text = String(n);
    if (changed) oninput?.(n);
    if (commit) onchange?.(n);
  }
  function typed() {
    editing = true;
    const v = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(v)) (value = v), oninput?.(v);
  }
  function commit() {
    editing = false;
    const v = parseFloat(text.replace(',', '.'));
    set(Number.isFinite(v) ? v : value, true);
  }
  function bump(dir: number, big: boolean, commit = true) {
    set((Number.isFinite(value) ? value : 0) + dir * (step || 1) * (big ? 10 : 1), commit);
  }
  function reset() {
    if (defaultValue !== undefined && !disabled) set(defaultValue, true);
  }
  function keydown(e: KeyboardEvent) {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'ArrowDown') bump(k === 'ArrowUp' ? 1 : -1, e.shiftKey);
    else if (k === 'PageUp' || k === 'PageDown') bump(k === 'PageUp' ? 1 : -1, true);
    else if (k === 'Home' && isFinite(min)) set(min, true);
    else if (k === 'End' && isFinite(max)) set(max, true);
    else if (k === 'Enter') commit();
    else if (k === 'Escape') (editing = false), (text = String(value));
    else return;
    e.preventDefault();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let shift = false;
  function hold(e: PointerEvent, dir: number) {
    if (e.button !== 0 || disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    shift = e.shiftKey;
    let delay = 400;
    const tick = () => {
      bump(dir, shift, false);
      if ((dir > 0 && value >= max) || (dir < 0 && value <= min)) return release();
      delay = Math.max(25, delay * 0.7);
      timer = setTimeout(tick, delay);
    };
    bump(dir, shift, false);
    timer = setTimeout(tick, delay);
  }
  function release() {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    onchange?.(value);
  }

  let sx = 0, sv = 0;
  function scrubStart(e: PointerEvent) {
    if (e.button !== 0 || disabled) return;
    const t = e.currentTarget as HTMLElement;
    t.setPointerCapture(e.pointerId);
    sx = e.clientX;
    sv = Number.isFinite(value) ? value : 0;
    let moved = false;
    const mv = (m: PointerEvent) => {
      const d = Math.round((m.clientX - sx) / 4);
      if (!d && !moved) return;
      moved = true;
      set(sv + d * (step || 1) * (m.shiftKey ? 10 : 1), false);
    };
    const end = () => {
      t.removeEventListener('pointermove', mv);
      t.removeEventListener('pointerup', end);
      t.removeEventListener('pointercancel', end);
      if (moved) onchange?.(value);
    };
    t.addEventListener('pointermove', mv);
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);
  }

  let fieldDrag = $state(false);
  function fieldDown(e: PointerEvent) {
    if (e.button !== 0 || disabled || coarse || e.pointerType === 'touch' || !el || document.activeElement === el) return;
    e.preventDefault(); // no focus/selection yet: decided on release (click) or after the threshold (scrub)
    const input = el, x0 = e.clientX, y0 = e.clientY, v0 = Number.isFinite(value) ? value : 0;
    input.setPointerCapture(e.pointerId);
    let active = false, acc = 0, lx = x0, ly = y0;
    const mv = (m: PointerEvent) => {
      if (!active) {
        if (Math.hypot(m.clientX - x0, m.clientY - y0) < 3) return;
        active = fieldDrag = true;
        lx = m.clientX; ly = m.clientY;
        return;
      }
      const fine = m.altKey || m.ctrlKey || m.metaKey;
      acc += ((m.clientX - lx) - (m.clientY - ly)) / (fine ? 10 : 1);
      lx = m.clientX; ly = m.clientY;
      set(v0 + Math.round(acc / 4) * (step || 1) * (m.shiftKey ? 10 : 1), false);
    };
    const key = (k: KeyboardEvent) => { if (k.key === 'Escape' && active) { k.preventDefault(); set(v0, false); end(null, true); } };
    const end = (u: PointerEvent | null, cancel = false) => {
      input.removeEventListener('pointermove', mv);
      input.removeEventListener('pointerup', up);
      input.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key, true);
      if (input.hasPointerCapture(e.pointerId)) input.releasePointerCapture(e.pointerId);
      fieldDrag = false;
      if (active) { if (!cancel || value !== v0) onchange?.(value); return; }
      if (!u) return;
      input.focus();
      const doc = document as any;
      const pos = doc.caretPositionFromPoint?.(u.clientX, u.clientY)?.offset ?? doc.caretRangeFromPoint?.(u.clientX, u.clientY)?.startOffset;
      if (typeof pos === 'number') input.setSelectionRange(pos, pos);
    };
    const up = (u: PointerEvent) => end(u);
    input.addEventListener('pointermove', mv);
    input.addEventListener('pointerup', up);
    input.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key, true);
  }

  $effect(() => {
    if (!wheel || !el) return;
    const node = el.parentElement!;
    const h = (e: WheelEvent) => {
      if (disabled || !node.contains(document.activeElement)) return;
      e.preventDefault();
      bump(e.deltaY < 0 ? 1 : -1, e.shiftKey);
    };
    node.addEventListener('wheel', h, { passive: false });
    return () => node.removeEventListener('wheel', h);
  });
</script>

<Field {label} {hint} {title} forId={id} scrub={scrub ? scrubStart : undefined} onreset={defaultValue !== undefined ? reset : undefined}>
  <div class="ui-num {size} {cls}" class:disabled class:steppers>
    <input
      bind:this={el}
      bind:value={text}
      {id}
      {title}
      {placeholder}
      {disabled}
      type="text"
      inputmode="decimal"
      autocomplete="off"
      spellcheck="false"
      role="spinbutton"
      aria-label={ariaLabel}
      aria-valuenow={Number.isFinite(value) ? value : undefined}
      aria-valuemin={isFinite(min) ? min : undefined}
      aria-valuemax={isFinite(max) ? max : undefined}
      oninput={typed}
      onchange={commit}
      onblur={() => editing && commit()}
      onkeydown={keydown}
      onpointerdown={fieldDown}
      class:scrubbing={fieldDrag}
    />
    {#if steppers}
      <span class="steps">
        {#each [1, -1] as dir (dir)}
          <button
            type="button"
            tabindex="-1"
            class="ui-step {dir > 0 ? 'up' : 'down'}"
            aria-label={dir > 0 ? 'Increase' : 'Decrease'}
            disabled={disabled || (dir > 0 ? atMax : atMin)}
            onpointerdown={(e) => hold(e, dir)}
            onpointerup={release}
            onpointercancel={release}
            onlostpointercapture={release}
            oncontextmenu={(e) => (e.preventDefault(), reset())}
          >{#if dir > 0}<ChevronUp size={12} strokeWidth={2.5} aria-hidden="true" />{:else}<ChevronDown size={12} strokeWidth={2.5} aria-hidden="true" />{/if}</button>
        {/each}
      </span>
    {/if}
  </div>
</Field>

<style>
  .ui-num {
    display: flex;
    align-items: stretch;
    box-sizing: border-box;
    width: 100%;
    height: var(--size-control);
    overflow: hidden;
    background: var(--color-field, var(--color-control));
    border-radius: var(--radius-md);
    transition: background-color var(--motion-fast);
  }
  .ui-num:hover:not(.disabled),
  .ui-num:focus-within {
    background: var(--color-control-hover);
  }
  @media (pointer: fine) {
    input:not(:focus):not(:disabled) {
      cursor: ew-resize;
    }
  }
  input.scrubbing {
    cursor: ew-resize;
    user-select: none;
  }
  input {
    flex: 1;
    min-width: 0;
    width: 100%;
    padding: 0 var(--space-3);
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--font-size-input);
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    background: transparent;
    border: 0;
    outline: none;
  }
  input::placeholder {
    color: var(--color-text-subtle);
    opacity: 1;
  }
  .disabled {
    opacity: var(--opacity-disabled);
  }
  .disabled input {
    cursor: not-allowed;
  }
  .steps {
    flex: none;
    display: flex;
    flex-direction: column;
    width: var(--size-stepper);
    background: var(--color-control-hover);
  }
  .ui-num:hover:not(.disabled) .steps,
  .ui-num:focus-within .steps {
    background: var(--color-control-active);
  }
  .steps button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 0;
    margin: 0;
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    transition: background-color var(--motion-fast), color var(--motion-fast);
  }
  .steps button:hover:not(:disabled) {
    color: var(--color-text-strong);
    background: var(--color-control-raised-active);
  }
  .steps button:active:not(:disabled) {
    background: var(--color-selection);
  }
  .steps button:active:not(:disabled) :global(svg) {
    transform: scale(0.8);
  }
  .steps button :global(svg) {
    transition: transform 80ms ease-out;
  }
  .steps button:disabled {
    opacity: var(--opacity-disabled);
    cursor: default;
  }
  .sm {
    height: var(--size-control-sm);
  }
  .sm input,
  .xs input {
    font-size: var(--font-size-label);
  }
  .xs {
    width: auto;
    height: 100%;
    min-height: 0;
    background: transparent;
    border-radius: 0;
  }
  .xs input {
    width: 4ch;
    flex: none;
    padding: 0 var(--space-1);
    text-align: center;
  }
</style>
