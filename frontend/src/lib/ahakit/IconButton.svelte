<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import type { LucideIcon } from '@lucide/svelte';
  import Button from './Button.svelte';
  import type { ButtonVariant, Size } from './types';

  type Props = Omit<HTMLButtonAttributes, 'size'> & {
    label: string;
    icon?: LucideIcon;
    variant?: ButtonVariant;
    size?: Size;
    pressed?: boolean;
    fill?: string;
    children?: Snippet;
  };
  let { label, icon, variant = 'ghost', size = 'md', pressed, title, children, ...rest }: Props = $props();
</script>

<Button {...rest} {variant} {size} {icon} iconOnly aria-label={label} title={title ?? label} aria-pressed={pressed}>
  {@render children?.()}
</Button>
