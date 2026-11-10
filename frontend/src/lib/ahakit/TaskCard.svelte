<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LucideIcon } from '@lucide/svelte';
  import X from '@lucide/svelte/icons/x';
  import Square from '@lucide/svelte/icons/square';
  import Loader from '@lucide/svelte/icons/loader-circle';
  import Check from '@lucide/svelte/icons/check';
  import Section from './Section.svelte';
  import ProgressPair from './ProgressPair.svelte';
  import IconButton from './IconButton.svelte';
  type Props = { title: string; icon?: LucideIcon; image?: string | null; progress?: { overall: number; current: number } | null; state?: 'run' | 'ok' | 'err' | 'cancel'; status?: string; children?: Snippet; actions?: Snippet; ondismiss?: () => void; oncancel?: () => void };
  let { title, icon, image, progress, state = 'run', status = '', children, actions, ondismiss, oncancel }: Props = $props();
</script>

{#snippet lead()}
  {#if state === 'run'}<span class="mark run"><Loader size={14} aria-hidden="true" /></span>
  {:else if state === 'ok'}<span class="mark ok"><Check size={14} aria-hidden="true" /></span>
  {:else if state === 'err'}<span class="mark err"><X size={14} aria-hidden="true" /></span>
  {:else if state === 'cancel'}<span class="mark cancel"><Square size={14} strokeWidth={2.5} aria-hidden="true" /></span>
  {:else if icon}{@const I = icon}<I size={14} aria-hidden="true" />{/if}
{/snippet}
{#snippet head()}
  {#if state === 'run' && oncancel}<IconButton icon={Square} variant="danger" label="Cancel" onclick={oncancel} />
  {:else if ondismiss}<IconButton icon={X} label="Remove" onclick={ondismiss} />{/if}
{/snippet}
<Section {title} plain class="task {state}" lead={lead} actions={oncancel || ondismiss ? head : undefined}>
  {#if image}<img class="img" src={image} alt="" />{/if}
  {#if progress}<ProgressPair overall={progress.overall} current={progress.current} label={title} />{/if}
  {#if status}<p class="msg {state}">{status}</p>{/if}
  {@render children?.()}
  {#if actions}<div class="aha-acts ui-dense">{@render actions()}</div>{/if}
</Section>

<style>
  .mark { display: inline-flex; flex: none; }
  .mark.run { animation: task-spin 1s linear infinite; }
  @keyframes task-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .mark.run { animation: none; } }
  .img { width: 100%; max-height: 160px; object-fit: contain; border-radius: var(--radius-sm); }
  .msg { margin: 0; font-size: var(--text-small, 12px); color: var(--color-ink-2); }
  .msg.ok { color: var(--color-ok-text); } .msg.err { color: var(--color-err-text); } .msg.cancel { color: var(--color-warn-text); }
  .mark.run { color: var(--color-run-icon); } .mark.ok { color: var(--color-ok-icon); } .mark.err { color: var(--color-err-text); } .mark.cancel { color: var(--color-warn-text); }
</style>
