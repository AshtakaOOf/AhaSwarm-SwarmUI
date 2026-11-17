<script lang="ts">
    let { side, open, label, onclick }: {
        side: 'left' | 'right';
        open: boolean;
        label: string;
        onclick: () => void;
    } = $props();

    // same chevron rule as the splitter edge toggle
    const fwd = $derived(side === 'right' ? open : !open);
    const chev = $derived(fwd ? 'M9.5 6l6 6-6 6' : 'M14.5 6L8.5 12l6 6');
</script>

<button
    type="button"
    class="edge"
    class:right={side === 'right'}
    aria-expanded={open}
    aria-label="{open ? 'Hide' : 'Show'} {label}"
    {onclick}
>
    <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path class="d" d={chev} /><path class="f" d={chev} />
    </svg>
</button>

<style>
    .edge {
        position: fixed;
        top: calc(var(--app-top, 0px) + (100dvh - var(--app-top, 0px)) / 2);
        left: max(0px, env(safe-area-inset-left));
        z-index: 35;
        width: 44px;
        height: 44px;
        margin-top: -22px;
        display: grid;
        place-items: center;
        padding: 0;
        background: none;
        border: 0;
        border-radius: var(--radius-ui);
        color: var(--color-ink);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    }
    .edge.right {
        left: auto;
        right: max(0px, env(safe-area-inset-right));
    }
    .edge svg {
        width: 28px;
        height: 28px;
        display: block;
        overflow: visible;
        filter: drop-shadow(0 1px 3px var(--color-overlay)) drop-shadow(0 0 6px var(--color-overlay));
    }
    .edge path {
        stroke-width: 2.9;
        transition: transform 80ms ease-out;
    }
    .edge .d {
        stroke: var(--color-thumb);
        transform: translateY(2.6px);
    }
    .edge .f {
        stroke: var(--color-ink);
    }
    .edge:hover .f {
        transform: translateY(-0.9px);
    }
    .edge:active .f {
        transform: translateY(2.6px);
    }
    .edge:focus-visible {
        outline: 2px solid var(--color-ring);
        outline-offset: 0;
    }
</style>
