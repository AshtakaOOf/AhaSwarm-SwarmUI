<script lang="ts">
  import Toggle from './Toggle.svelte';
  import InfoButton from './InfoButton.svelte';

  type Props = { label: string; description?: string; info?: string; checked?: boolean; disabled?: boolean; onchange?: (checked: boolean) => void };
  let { label, description, info, checked = $bindable(false), disabled = false, onchange }: Props = $props();
</script>

<div class="ui-switch-row">
  <div class="txt">
    <span class="lbl">{label}{#if info}<InfoButton {label} text={info} />{/if}</span>
    {#if description}<span class="desc">{description}</span>{/if}
  </div>
  <Toggle hideLabel {label} {disabled} bind:checked {onchange} />
</div>

<style>
  .ui-switch-row { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .lbl { display: flex; align-items: center; gap: var(--space-1); color: var(--color-ink); font-size: var(--text-ui); }
  .desc { color: var(--color-ink-3); font-size: var(--text-small); line-height: 1.35; }
</style>
