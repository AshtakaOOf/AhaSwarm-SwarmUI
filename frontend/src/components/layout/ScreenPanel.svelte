<script lang="ts">
    import type { Snippet } from 'svelte';
    import { portal } from '../ui';
    import { swipe, type SwipeInfo } from '../../lib/util/swipe';

    let {
        open = $bindable(false),
        title,
        side = 'left',
        children,
        shift = null,
        dragging = false,
        ondrag,
        ondragend,
        prewarm = false,
    }: {
        open?: boolean;
        title: string;
        side?: 'left' | 'right';
        children: Snippet;
        shift?: number | null;
        dragging?: boolean;
        ondrag?: (info: SwipeInfo) => void;
        ondragend?: (info: SwipeInfo) => void;
        prewarm?: boolean;
    } = $props();

    let panel = $state<HTMLDivElement>();
    let shown = $state(false);
    let self = $state(0);
    let leaving = $state(false);
    const off = $derived(side === 'left' ? -100 : 100);
    const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tx = $derived(shift ?? self);
    const live = $derived(open || shift != null);

    $effect(() => {
        if (shift != null) {
            shown = true;
            leaving = false;
            self = shift;
            return;
        }
        if (open) {
            if (!shown) {
                shown = true;
                if (reduce()) {
                    self = 0;
                }
                else {
                    self = off;
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        if (open) {
                            self = 0;
                        }
                    }));
                }
            }
            else if (!leaving) {
                self = 0;
            }
        }
        else if (shown) {
            leaving = !(reduce() || self === off);
            self = off;
        }
        else if (prewarm) {
            shown = true;
            self = off;
        }
    });

    function ended(e: TransitionEvent) {
        if (e.propertyName !== 'transform' || e.target !== e.currentTarget) {
            return;
        }
        if (leaving && !open) {
            leaving = false;
            self = off;
        }
    }

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

{#if shown}
    <div class="wrap" class:left={side === 'left'} class:right={side === 'right'} class:live use:portal role="presentation" inert={!live} aria-hidden={!live} onkeydown={keydown}>
        <div bind:this={panel} class="panel" class:dragging role="dialog" aria-modal={live} aria-label={title} tabindex="-1" style="transform: translate3d({tx}%, 0, 0)" use:swipe={{ onmove: ondrag, onend: ondragend, enabled: live, only: 'x' }} ontransitionend={ended}>
            <div class="body">{@render children()}</div>
        </div>
    </div>
{/if}

<style>
    .wrap { position: fixed; top: var(--app-top, 0px); left: 0; right: 0; height: calc(100dvh - var(--app-top, 0px) - var(--strip-h, 0px)); z-index: 30; overflow: hidden; overscroll-behavior: none; }
    .wrap:not(.live) { pointer-events: none; }
    .panel { display: flex; flex-direction: column; position: absolute; inset: 0; height: auto; min-height: 0; min-width: 0; background: var(--color-bg); outline: none; overflow: hidden; overscroll-behavior-x: none; touch-action: pan-y; }
    .panel:not(.dragging) { transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    .panel.dragging { transition: none; }
    .body { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden; overscroll-behavior: contain; overscroll-behavior-x: none; }
    @media (prefers-reduced-motion: reduce) {
        .panel, .panel:not(.dragging) { transition: none; }
    }
</style>
