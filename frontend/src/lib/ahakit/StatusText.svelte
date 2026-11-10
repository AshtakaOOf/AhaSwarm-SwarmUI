<script lang="ts">
  import Info from '@lucide/svelte/icons/info';
  import Check from '@lucide/svelte/icons/check';
  import Triangle from '@lucide/svelte/icons/triangle-alert';
  import Ban from '@lucide/svelte/icons/ban';
  import Loader from '@lucide/svelte/icons/loader-circle';
  export type StatusTone = 'idle' | 'ok' | 'warn' | 'err' | 'busy';
  let { tone = 'idle', text, class: cls = '' }: { tone?: StatusTone; text: string; class?: string } = $props();
  const I = $derived(tone === 'ok' ? Check : tone === 'err' ? Ban : tone === 'warn' ? Triangle : tone === 'busy' ? Loader : Info);
</script>

<div class="st {tone} {cls}" role="status"><I size={14} class={tone === 'busy' ? 'spin' : ''} aria-hidden="true" /><span>{text}</span></div>

<style>
  .st { display: flex; align-items: flex-start; gap: 6px; font-size: var(--text-small, 12px); color: var(--color-ink-3); line-height: 16px; padding: 4px 0; }
  .st :global(svg) { flex: none; margin-top: 1px; }
  .st.ok { color: var(--color-ok-text); } .st.err { color: var(--color-err-text); } .st.warn { color: var(--color-warn-text); } .st.busy { color: var(--color-ink-2); }
  .st :global(.spin) { animation: st-spin 1s linear infinite; }
  @keyframes st-spin { to { transform: rotate(360deg); } }
</style>
