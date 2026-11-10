<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
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
  let { value = $bindable(''), label, hint, title, invalid = false, id = uid('in'), type = 'text', class: cls = '', oninput, onchange, ref = $bindable(), ...rest }: Props = $props();
</script>

<Field {label} {hint} {title} forId={id}>
  <input
    {...rest}
    bind:this={ref}
    {id}
    {type}
    {title}
    class="ctl ctl-field w-full min-w-0 justify-start text-left placeholder:text-ink-3 hover:bg-hover focus:bg-hover disabled:opacity-45 aria-[invalid=true]:bg-[var(--color-danger-soft)] aria-[invalid=true]:text-[#e48c8c] {cls}"
    aria-invalid={invalid || undefined}
    bind:value
    oninput={() => oninput?.(value)}
    onchange={() => onchange?.(value)}
  />
</Field>

