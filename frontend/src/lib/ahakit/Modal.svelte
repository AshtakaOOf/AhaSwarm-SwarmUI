<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';
  import X from '@lucide/svelte/icons/x';
  import { focusables, portal, uid } from './util';

  type Props = {
    open?: boolean;
    title?: string;
    // muted text shown immediately after the title (e.g. "by Author")
    subtitle?: string;
    onsubtitleclick?: () => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    tone?: 'raised' | 'panel' | 'clear';
    sheet?: boolean | 'auto';
    fullscreen?: boolean | 'auto';
    side?: 'left' | 'right';
    dismissable?: boolean;
    // close on a press and release that both happen on the backdrop (defaults to dismissable)
    backdropClose?: boolean;
    id?: string;
    class?: string;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
  };
  let { open = $bindable(false), title, subtitle, onsubtitleclick, size = 'md', tone = 'raised', sheet = 'auto', fullscreen = false, side, dismissable = true, backdropClose, id = uid('dlg'), class: cls = '', onclose, children, footer }: Props = $props();
  let panel: HTMLDivElement | undefined = $state();
  const closesOnBackdrop = $derived(backdropClose ?? dismissable);

  function close() {
    open = false;
    onclose?.();
  }

  function backdropDown(e: PointerEvent) {
    if (!closesOnBackdrop || e.target !== e.currentTarget || e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      cleanup();
      if (ev.target === el) close();
    };
    const cleanup = () => {
      removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', cleanup, true);
    };
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', cleanup, true);
  }

  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && dismissable) {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab' && panel) {
      const f = focusables(panel);
      if (!f.length) return e.preventDefault();
      const [a, z] = [f[0], f[f.length - 1]];
      const cur = document.activeElement;
      if (e.shiftKey && (cur === a || cur === panel)) e.preventDefault(), z.focus();
      else if (!e.shiftKey && cur === z) e.preventDefault(), a.focus();
    }
  }

  $effect(() => {
    if (!open || !panel) return;
    const prev = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    (panel.querySelector<HTMLElement>('[autofocus]') ?? focusables(panel).find((e) => !e.matches('.close')) ?? panel).focus();
    return () => {
      html.style.overflow = overflow;
      prev?.focus?.();
    };
  });
</script>

{#if open}
  <div use:portal class="ui-modal" class:sheet={sheet === true} class:auto={sheet === 'auto' && !side} class:drawer={!!side} class:left={side === 'left'} class:full={fullscreen === true} class:auto-full={fullscreen === 'auto'} role="presentation" onkeydown={keydown}>
    <div class="backdrop" aria-hidden="true" onpointerdown={backdropDown}></div>
    <div bind:this={panel} class="panel ui-raised {size} {cls}" class:tone-panel={tone === 'panel'} class:tone-clear={tone === 'clear'} role="dialog" aria-modal="true" aria-labelledby={title ? `${id}-t` : undefined} aria-label={title ? undefined : 'Dialog'} aria-describedby="{id}-b" tabindex="-1">
      {#if title || subtitle || dismissable}
        <header>
          {#if title || subtitle}
            <div class="title">
              {#if title}<h2 id="{id}-t">{title}</h2>{/if}
              {#if subtitle}
                {#if onsubtitleclick}<button type="button" class="subtitle" onclick={onsubtitleclick}>{subtitle}</button>{:else}<span class="subtitle">{subtitle}</span>{/if}
              {/if}
            </div>
          {/if}
          {#if dismissable}<IconButton class="close" icon={X} label="Close" onclick={close} />{/if}
        </header>
      {/if}
      <div class="body" id="{id}-b">{@render children()}</div>
      {#if footer}<footer>{@render footer()}</footer>{/if}
    </div>
  </div>
{/if}

<style>
  .ui-modal { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 12px; color: var(--color-ink); }
  .backdrop { position: absolute; inset: 0; background: var(--color-backdrop); }
  .panel { position: relative; display: flex; flex-direction: column; box-sizing: border-box; width: 100%; max-width: 440px; max-height: 100%;
    background: var(--color-raised); border-radius: var(--radius-ui); font-size: var(--text-ui); outline: none; animation: pop-in 120ms ease-out; }
  .sm { max-width: 300px; }
  .lg { max-width: 800px; }
  header { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 8px 0 16px; }
  .title { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 6px; }
  h2 { min-width: 0; margin: 0; font-size: var(--text-body); font-weight: 600; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .subtitle { min-width: 0; font-size: var(--text-body); color: var(--color-ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  button.subtitle { padding: 0; border: 0; background: none; cursor: pointer; }
  button.subtitle:hover, button.subtitle:focus-visible { color: var(--color-ink-2); text-decoration: underline; }
  header :global(.close) { margin-left: auto; }
  .tone-panel { background: var(--param-panel-bg); }
  .body { flex: 1; min-height: 0; padding: 8px 16px 16px; overflow-y: auto; overscroll-behavior: contain; line-height: 1.5; color: var(--color-ink-2); }
  footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding: 0 16px 16px; }
  .sheet { align-items: flex-end; padding: 0; }
  .sheet .panel { max-width: none; max-height: 90%; border-radius: var(--radius-ui) var(--radius-ui) 0 0; padding-bottom: env(safe-area-inset-bottom); animation: slide-up 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  @media (max-width: 639px) {
    .auto { align-items: flex-end; padding: 0; }
    .auto .panel { max-width: none; max-height: 90%; border-radius: var(--radius-ui) var(--radius-ui) 0 0; padding-bottom: env(safe-area-inset-bottom); animation: slide-up 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  }
  .drawer { justify-content: flex-end; align-items: stretch; padding: 0; }
  .drawer.left { justify-content: flex-start; }
  .drawer .backdrop { background: var(--color-scrim); }
  .drawer .panel { max-width: min(440px, 100%); max-height: none; border-radius: 0; background: var(--color-panel); box-shadow: var(--shadow-panel);
    padding-bottom: env(safe-area-inset-bottom); animation: slide-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  .drawer header { min-height: 48px; padding: 0 8px 0 12px; background: var(--color-raised); }
  .drawer h2 { font-size: var(--text-small); font-weight: 400; color: var(--color-ink-2); }
  .drawer .body { padding: 12px; }
  .drawer.left .panel { animation-name: ui-left; }
  @keyframes ui-left { from { opacity: 0; transform: translateX(-24px); } }
  .xl { max-width: min(1680px, 100%); width: 100%; height: min(1080px, 100%); overflow: hidden; }
  .xl .body { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
  .tone-clear { background: transparent; }
  .full { padding: 0; }
  .full .panel { max-width: none; width: 100%; height: 100%; max-height: none; border-radius: 0; padding-bottom: env(safe-area-inset-bottom); }
  @media (max-width: 639px) {
    .auto-full { padding: 0; }
    .auto-full .panel { max-width: none; width: 100%; height: 100%; max-height: none; border-radius: 0; padding-bottom: env(safe-area-inset-bottom); }
  }
</style>
