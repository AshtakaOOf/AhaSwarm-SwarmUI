<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import Field from './Field.svelte';
  import { uid } from './util';

  type Props = Omit<HTMLTextareaAttributes, 'value' | 'oninput' | 'onchange'> & {
    value?: string;
    label?: string;
    hint?: string;
    autosize?: boolean;
    mono?: boolean;
    maxRows?: number;
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
    onsubmit?: (value: string) => void;
    ref?: HTMLTextAreaElement;
  };
  let {
    value = $bindable(''),
    label,
    hint,
    title,
    autosize = true,
    mono = false,
    rows = 2,
    maxRows = 12,
    id = uid('ta'),
    class: cls = '',
    oninput,
    onchange,
    onsubmit,
    onkeydown,
    ref = $bindable(),
    ...rest
  }: Props = $props();

  let el: HTMLTextAreaElement | undefined = $state();
  $effect(() => {
    ref = el;
  });
  let width = 0;

  function fit() {
    if (!el || !autosize) return;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || 18;
    const extra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const max = maxRows * lh + extra;
    const top = el.scrollTop;
    el.style.height = 'auto';
    const h = el.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.height = Math.min(h, max) + 'px';
    const ov = h > max ? 'auto' : 'hidden';
    if (el.style.overflowY !== ov) el.style.overflowY = ov;
    el.scrollTop = top;
  }

  $effect(() => {
    void value;
    fit();
  });

  $effect(() => {
    if (!el || !autosize || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width !== width) (width = e.contentRect.width), fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  function keydown(e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
    onkeydown?.(e);
    if (onsubmit && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onsubmit(value);
    }
  }
</script>

<Field {label} {hint} {title} forId={id}>
  <textarea
    {...rest}
    bind:this={el}
    bind:value
    {id}
    {rows}
    {title}
    class="ui-ta block w-full rounded-ui bg-[var(--color-field,var(--color-raised))] px-2.5 py-[6.5px] text-ui leading-[19px] placeholder:text-ink-3 hover:bg-hover focus:bg-hover disabled:opacity-45 {autosize ? 'resize-none overflow-y-hidden' : 'resize-y'} {mono ? 'font-mono' : ''} {cls}"
    oninput={() => oninput?.(value)}
    onchange={() => onchange?.(value)}
    onkeydown={keydown}
  ></textarea>
</Field>

