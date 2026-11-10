<script lang="ts">
  import Button from './Button.svelte';

  type Props = { remaining: number; auto?: boolean; label?: string; margin?: string; onmore: () => void };
  let { remaining, auto = false, label = 'Show more', margin = '800px', onmore }: Props = $props();
  let sentinel: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!auto || !sentinel || remaining <= 0) return;
    void remaining; // re-observe after each page: the first callback reports the current state, so a short page keeps filling
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) onmore(); }, { rootMargin: margin });
    io.observe(sentinel);
    return () => io.disconnect();
  });
</script>

{#if remaining > 0}
  {#if auto}
    <div bind:this={sentinel} class="ui-load-more" role="status" aria-label="Loading more ({remaining} left)"></div>
  {:else}
    <Button block onclick={onmore}>{label} ({remaining} left)</Button>
  {/if}
{/if}

<style>
  .ui-load-more { height: 1px; }
</style>
