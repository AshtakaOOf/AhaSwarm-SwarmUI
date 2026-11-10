<script lang="ts">
    import ParamPanel from '../params/ParamPanel.svelte';
    import CurrentImage from './CurrentImage.svelte';
    import BatchPanel from './BatchPanel.svelte';
    import BottomBar from './BottomBar.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { Drawer, Splitter } from '../ui';
    import { untrack } from 'svelte';

    let browserCollapsed = $state(false);
    let browserSize = $state<number>();
    function expandBrowser() {
        if (browserCollapsed) {
            browserSize = Math.max(browserSize ?? 0, 25);
        }
        browserCollapsed = false;
    }
    let seenOpenReq = ui.bottomOpenReq;
    $effect(() => {
        const req = ui.bottomOpenReq;
        if (req !== seenOpenReq) {
            seenOpenReq = req;
            untrack(expandBrowser);
        }
    });
    // the browser pane collapses to the model bar + tab row instead of hiding them
    let genEl = $state<HTMLDivElement>();
    let stripEl = $state<HTMLDivElement>();
    let stripPct = $state(0);
    $effect(() => {
        const g = genEl, strip = stripEl;
        if (!g || !strip) {
            return;
        }
        const update = () => {
            const h = g.clientHeight;
            stripPct = h > 0 ? (strip.offsetHeight / h) * 100 : 0;
        };
        const ro = new ResizeObserver(update);
        ro.observe(g);
        ro.observe(strip);
        update();
        return () => ro.disconnect();
    });
    const AVOID = '.panel, aside.batch';
    const mq = typeof matchMedia === 'function' ? matchMedia('(max-width: 760px)') : null;
    let narrow = $state(mq?.matches ?? false);
    $effect(() => {
        if (!mq) {
            return;
        }
        const on = (e: MediaQueryListEvent) => { narrow = e.matches; if (!e.matches) { ui.paramsOpen = false; } };
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    });
</script>

{#snippet center()}
    <div class="image"><CurrentImage /></div>
{/snippet}

{#snippet top()}
    {#if narrow}
        <Drawer side="left" title="Parameters" bind:open={ui.paramsOpen}><div class="fill"><ParamPanel /></div></Drawer>
        <Splitter direction="vertical" persistKey="ahaswarm.split.batch.narrow" label="Resize batch panel" reverse defaultSize={90} min={60} max={400} unit="px" collapsible>
            {#snippet first()}{@render center()}{/snippet}
            {#snippet second()}<BatchPanel />{/snippet}
        </Splitter>
    {:else}
        <Splitter persistKey="ahaswarm.split.params" label="Resize parameters panel" defaultSize={448} min={240} max={816} unit="px" collapsible>
            {#snippet first()}<ParamPanel />{/snippet}
            {#snippet second()}
                <Splitter persistKey="ahaswarm.split.batch" label="Resize batch panel" reverse defaultSize={336} min={120} max={900} unit="px" collapsible>
                    {#snippet first()}{@render center()}{/snippet}
                    {#snippet second()}<BatchPanel />{/snippet}
                </Splitter>
            {/snippet}
        </Splitter>
    {/if}
{/snippet}

<!-- bottom region: edge → model bar → tabs → content -->
<div class="gen" bind:this={genEl}>
    <Splitter direction="vertical" persistKey={narrow ? 'ahaswarm.split.browser.narrow' : 'ahaswarm.split.browser'} label="Resize browser panel" dragFloor={36} reverse defaultSize={narrow ? 28 : 45} min={Math.max(10, stripPct + 5)} max={85} unit="%" collapsible collapseTo={stripPct} paneOverflow="hidden" bind:size={browserSize} bind:collapsed={browserCollapsed} avoid={AVOID}>
        {#snippet first()}{@render top()}{/snippet}
        {#snippet second()}<BottomBar bind:stripEl open={!browserCollapsed} onopen={expandBrowser} onclose={() => (browserCollapsed = true)} />{/snippet}
    </Splitter>
</div>

<style>
    .gen { height: 100%; min-height: 0; display: flex; flex-direction: column; }
    .gen > :global(.ui-splitter) { flex: 1; min-height: 0; }
    .image { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .fill { height: 100%; min-height: 0; }
</style>
