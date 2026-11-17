<script lang="ts">
    import type { Snippet } from 'svelte';
    import { portal } from '../ui';
    import { swipe, type SwipeDir } from '../../lib/util/swipe';

    let { open = $bindable(false), title, side = 'left', children, onswipe }: {
        open?: boolean;
        title: string;
        side?: 'left' | 'right';
        children: Snippet;
        onswipe?: (dir: SwipeDir) => void;
    } = $props();

    let panel = $state<HTMLDivElement>();

    function close() {
        open = false;
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
        }
    }

    $effect(() => {
        if (!open || !panel) {
            return;
        }
        const prev = document.activeElement as HTMLElement | null;
        panel.focus();
        return () => prev?.focus?.();
    });
</script>

{#if open}
    <div class="wrap" class:left={side === 'left'} class:right={side === 'right'} use:portal role="presentation" onkeydown={keydown}>
        <div bind:this={panel} class="panel" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" use:swipe={{ onswipe, enabled: open }}>
            <div class="body">{@render children()}</div>
        </div>
    </div>
{/if}

<style>
    .wrap { position: fixed; top: var(--app-top, 0px); left: 0; right: 0; height: calc(100dvh - var(--app-top, 0px) - var(--strip-h, 0px)); z-index: 30; overflow: hidden; overscroll-behavior: none; }
    .panel { display: flex; flex-direction: column; position: absolute; inset: 0; height: auto; min-height: 0; min-width: 0; background: var(--color-bg); outline: none; overflow: hidden; overscroll-behavior-x: none; touch-action: pan-y; }
    .left .panel { animation: in-left 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    .right .panel { animation: in-right 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    .body { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden; overscroll-behavior: contain; overscroll-behavior-x: none; }
    @keyframes in-left { from { opacity: 0; transform: translateX(-24px); } }
    @keyframes in-right { from { opacity: 0; transform: translateX(24px); } }
</style>
