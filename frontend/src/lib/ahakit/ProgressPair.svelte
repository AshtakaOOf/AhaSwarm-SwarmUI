<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  let { overall, current, label = 'Progress' }: { overall: number; current: number; label?: string } = $props();
</script>

<div class="pp"><ProgressBar value={overall} hideLabel ariaLabel="{label}: overall" /><ProgressBar value={current} hideLabel ariaLabel="{label}: current step" /></div>

<style>
  .pp { display: flex; flex-direction: column; gap: 2px; }
</style>
