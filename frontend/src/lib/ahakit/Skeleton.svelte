<script lang="ts">
  type Props = { width?: string; height?: string; radius?: string; lines?: number; circle?: boolean; fill?: boolean; label?: string };
  let { width, height, radius, lines = 0, circle = false, fill = false, label = 'Loading' }: Props = $props();
</script>

{#if lines > 0}
  <span class="flex w-full flex-col gap-[7px]" role="status" aria-label={label} style:width>
    {#each Array(lines) as _, i (i)}<span class="shim is-loading relative block h-3 rounded-sm bg-raised" style:width={i === lines - 1 && lines > 1 ? '66%' : undefined}></span>{/each}
  </span>
{:else}
  <span
    class="shim is-loading block bg-raised {fill ? 'absolute inset-0 rounded-none' : 'relative h-8 w-full rounded-sm'} {circle ? 'aspect-square h-auto rounded-full' : ''}"
    role={fill ? undefined : 'status'}
    aria-label={fill ? undefined : label}
    aria-hidden={fill ? 'true' : undefined}
    style:width
    style:height
    style:border-radius={radius}
  ></span>
{/if}
