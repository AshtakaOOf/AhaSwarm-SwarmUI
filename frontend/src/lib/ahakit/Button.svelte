<script lang="ts">
  import type { Snippet } from 'svelte';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { toastError, toastSuccess } from './toasts.svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import type { LucideIcon } from '@lucide/svelte';
  import type { ButtonVariant, Size } from './types';

  type Props = Omit<HTMLButtonAttributes, 'size'> & {
    variant?: ButtonVariant;
    size?: Size;
    block?: boolean;
    /** Lucide component shown before the label */
    icon?: LucideIcon;
    iconOnly?: boolean;
    fill?: string;
    loading?: boolean;
    /** success toast after the promise returned by onclick resolves */
    done?: string;
    children?: Snippet;
  };
  let { variant = 'default', size = 'md', block = false, icon, iconOnly = false, fill, loading = false, done, type = 'button', class: cls = '', children, onclick, disabled, ...rest }: Props = $props();
  let pending = $state(false);
  const busy = $derived(loading || pending);
  function click(e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
    const r = (onclick as ((e: MouseEvent) => unknown) | null | undefined)?.(e);
    if (!r || typeof (r as Promise<unknown>).then !== 'function') return;
    pending = true;
    (r as Promise<unknown>).then(
      () => { if (done) toastSuccess(done); },
      (err) => toastError(err instanceof Error ? err.message : String(err)),
    ).finally(() => (pending = false));
  }
  const vcls = $derived(variant === 'primary' ? 'ctl-strong' : variant === 'ghost' ? 'ctl-ghost' : variant === 'danger' ? 'ctl-danger' : '');
</script>

<button {type} class="ctl shrink-0 {vcls} {size === 'hero' ? 'ctl-hero' : ''} {iconOnly ? 'ctl-icon' : ''} {block ? 'flex w-full' : ''} {cls}" {...rest}
  disabled={disabled || busy} aria-busy={busy || undefined} onclick={click}>
  {#if busy}<LoaderCircle size={15} class="shrink-0 animate-spin" aria-hidden="true" />{:else if icon}{@const I = icon}<I size={15} class="shrink-0" aria-hidden="true" fill={fill ?? 'none'} />{/if}{#if !(busy && iconOnly)}{@render children?.()}{/if}
</button>
