<script lang="ts">
    import ParamPanel from '../params/ParamPanel.svelte';
    import CurrentImage from './CurrentImage.svelte';
    import BatchPanel from './BatchPanel.svelte';
    import BottomBar from './BottomBar.svelte';
    import ImageEditorModal from '../editor/ImageEditorModal.svelte';
    import ScreenPanel from '../layout/ScreenPanel.svelte';
    import EdgeToggle from '../layout/EdgeToggle.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { Splitter } from '../ui';
    import { swipe, type SwipeDir } from '../../lib/util/swipe';
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
    let stripH = $state(0);
    $effect(() => {
        const g = genEl, strip = stripEl;
        if (!g || !strip) {
            return;
        }
        const update = () => {
            const h = g.clientHeight;
            stripPct = h > 0 ? (strip.offsetHeight / h) * 100 : 0;
            stripH = strip.offsetHeight;
            document.documentElement.style.setProperty('--strip-h', `${strip.offsetHeight}px`);
        };
        const ro = new ResizeObserver(update);
        ro.observe(g);
        ro.observe(strip);
        update();
        return () => {
            ro.disconnect();
            document.documentElement.style.removeProperty('--strip-h');
        };
    });
    const AVOID = '.panel, aside.batch';
    $effect(() => {
        if (!ui.mobile || ui.page !== 'generate') {
            untrack(() => {
                ui.paramsOpen = false;
                ui.batchOpen = false;
            });
        }
        if (ui.mobile) {
            untrack(() => { browserCollapsed = true; });
        }
    });

    function closeOthers(keep: 'params' | 'batch' | 'bottom') {
        if (keep !== 'params') {
            ui.paramsOpen = false;
        }
        if (keep !== 'batch') {
            ui.batchOpen = false;
        }
        if (keep !== 'bottom') {
            browserCollapsed = true;
        }
    }

    function onMidSwipe(dir: SwipeDir) {
        if (dir === 'right') {
            closeOthers('params');
            ui.paramsOpen = true;
        }
        else if (dir === 'left') {
            closeOthers('batch');
            ui.batchOpen = true;
        }
        else if (dir === 'up') {
            closeOthers('bottom');
            expandBrowser();
        }
        else if (dir === 'down' && !browserCollapsed) {
            browserCollapsed = true;
        }
    }
</script>

{#snippet center()}
    <div class="image"><CurrentImage /></div>
{/snippet}

{#snippet top()}
    {#if ui.mobile}
        <div class="mid" use:swipe={{ onswipe: onMidSwipe, enabled: ui.mobile }}>
            {@render center()}
        </div>
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
<div class="gen" bind:this={genEl} style:--strip-h="{stripH}px">
    {#if ui.mobile}
        {@render top()}
        <div class="dock"><BottomBar bind:stripEl open={!browserCollapsed} onopen={() => { closeOthers('bottom'); expandBrowser(); }} onclose={() => (browserCollapsed = true)} /></div>
    {:else}
        <Splitter direction="vertical" persistKey="ahaswarm.split.browser" label="Resize browser panel" dragFloor={36} reverse defaultSize={45} min={Math.max(10, stripPct + 5)} max={85} unit="%" collapsible collapseTo={stripPct} paneOverflow="hidden" bind:size={browserSize} bind:collapsed={browserCollapsed} avoid={AVOID}>
            {#snippet first()}{@render top()}{/snippet}
            {#snippet second()}<BottomBar bind:stripEl open={!browserCollapsed} onopen={expandBrowser} onclose={() => (browserCollapsed = true)} />{/snippet}
        </Splitter>
    {/if}
</div>

{#if ui.mobile && ui.page === 'generate'}
    {#if !ui.paramsOpen && !ui.batchOpen}
        <EdgeToggle side="left" open={false} label="parameters panel" onclick={() => { ui.batchOpen = false; ui.paramsOpen = true; }} />
        <EdgeToggle side="right" open={false} label="batch panel" onclick={() => { ui.paramsOpen = false; ui.batchOpen = true; }} />
    {/if}
    <ScreenPanel bind:open={ui.paramsOpen} title="Parameters" side="left" onswipe={(d) => { if (d === 'left') ui.paramsOpen = false; }}>
        <ParamPanel />
    </ScreenPanel>
    <ScreenPanel bind:open={ui.batchOpen} title="Output" side="right" onswipe={(d) => { if (d === 'right') ui.batchOpen = false; }}>
        <BatchPanel />
    </ScreenPanel>
{/if}

<ImageEditorModal />

<style>
    .gen { height: 100%; min-height: 0; display: flex; flex-direction: column; }
    .gen > :global(.ui-splitter) { flex: 1; min-height: 0; }
    .image { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .mid { flex: 1; min-height: 0; touch-action: none; }
    .dock { flex: none; }
</style>
