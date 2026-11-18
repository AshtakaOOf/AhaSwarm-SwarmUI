<script lang="ts">
    import ParamPanel from '../params/ParamPanel.svelte';
    import CurrentImage from './CurrentImage.svelte';
    import BatchPanel from './BatchPanel.svelte';
    import BottomBar from './BottomBar.svelte';
    import ImageEditorModal from '../editor/ImageEditorModal.svelte';
    import ScreenPanel from '../layout/ScreenPanel.svelte';
    import EdgeToggle from '../layout/EdgeToggle.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { gen } from '../../lib/state/gen.svelte';
    import { Splitter } from '../ui';
    import { swipe, type SwipeInfo } from '../../lib/util/swipe';
    import { untrack } from 'svelte';

    let browserCollapsed = $state(false);
    let browserSize = $state<number>();
    let mobileBrowserSize = $state<number>();
    function expandBrowser() {
        if (browserCollapsed) {
            if (ui.mobile) {
                mobileBrowserSize = browserMax;
            }
        }
        browserCollapsed = false;
        ui.bottomOpen = ui.mobile;
    }
    function collapseBrowser() {
        browserCollapsed = true;
        ui.bottomOpen = false;
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
    let genH = $state(0);
    const browserMax = $derived(genH > 4 ? ((genH - 4) / genH) * 100 : 99);
    const atTop = $derived(!browserCollapsed && (mobileBrowserSize ?? 0) >= browserMax - 0.5);
    const hasImage = $derived(!!gen.current);
    $effect(() => {
        const g = genEl, strip = stripEl;
        if (!g || !strip) {
            return;
        }
        const update = () => {
            const h = g.clientHeight;
            genH = h;
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
    let mobileInited = false;
    $effect(() => {
        if (!ui.mobile || ui.page !== 'generate') {
            untrack(() => {
                ui.paramsOpen = false;
                ui.batchOpen = false;
            });
        }
        // only the first time we enter mobile, so a rotate does not close the drawer
        if (ui.mobile && !mobileInited) {
            mobileInited = true;
            untrack(collapseBrowser);
        }
    });

    $effect(() => {
        if (ui.mobile && !ui.bottomOpen && !browserCollapsed) {
            untrack(collapseBrowser);
        }
    });

    let sheetWarm = $state(false);
    $effect(() => {
        if (!ui.mobile || ui.page !== 'generate') {
            return;
        }
        const go = () => { sheetWarm = true; };
        if (typeof requestIdleCallback === 'function') {
            const id = requestIdleCallback(go);
            return () => cancelIdleCallback(id);
        }
        const t = setTimeout(go, 200);
        return () => clearTimeout(t);
    });

    function closeOthers(keep: 'params' | 'batch' | 'bottom') {
        if (keep !== 'params') {
            ui.paramsOpen = false;
        }
        if (keep !== 'batch') {
            ui.batchOpen = false;
        }
        if (keep !== 'bottom') {
            collapseBrowser();
        }
    }

    const SNAP = 180;
    const FLING = 0.3;
    const SNAP_PX = 40;
    const SNAP_FRAC = 0.15;
    const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    type Sheet = 'params' | 'batch' | 'bottom';
    let midAxis = $state<Sheet | null>(null);
    let sheetWhich = $state<'params' | 'batch' | null>(null);
    let sheetShift = $state<number | null>(null);
    let sheetDrag = $state(false);
    let bottomFrom = 0;
    let bottomDragging = false;
    let snapTimer = 0;
    let sizeRaf = 0;

    function sheetOff(which: 'params' | 'batch') {
        return which === 'params' ? -100 : 100;
    }

    function panelW() {
        return document.documentElement.clientWidth || window.innerWidth;
    }

    function wantOpen(progress: number, vOpen: number, startedOpen = false) {
        if (Math.abs(vOpen) >= FLING) {
            return vOpen > 0;
        }
        const w = panelW();
        const movedPx = (progress - (startedOpen ? 1 : 0)) * w;
        const need = Math.min(SNAP_PX, w * SNAP_FRAC);
        if (Math.abs(movedPx) >= need) {
            return movedPx > 0;
        }
        return startedOpen;
    }

    function lerpSize(to: number, done?: () => void) {
        cancelAnimationFrame(sizeRaf);
        const from = mobileBrowserSize ?? stripPct;
        if (reduce()) {
            mobileBrowserSize = to;
            done?.();
            return;
        }
        const t0 = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - t0) / SNAP);
            const e = 1 - (1 - t) ** 3;
            mobileBrowserSize = from + (to - from) * e;
            if (t < 1) {
                sizeRaf = requestAnimationFrame(tick);
            }
            else {
                mobileBrowserSize = to;
                done?.();
            }
        };
        sizeRaf = requestAnimationFrame(tick);
    }

    function beginBottom() {
        cancelAnimationFrame(sizeRaf);
        closeOthers('bottom');
        if (browserCollapsed) {
            mobileBrowserSize = stripPct;
            browserCollapsed = false;
        }
        ui.bottomOpen = true;
        bottomFrom = mobileBrowserSize ?? stripPct;
        bottomDragging = true;
    }

    function rubber(v: number, lo: number, hi: number) {
        const span = Math.max(6, (hi - lo) * 0.25);
        if (v < lo) {
            const extra = lo - v;
            return lo - extra * span / (span + extra);
        }
        if (v > hi) {
            const extra = v - hi;
            return hi + extra * span / (span + extra);
        }
        return v;
    }

    function onBottomMove(info: SwipeInfo) {
        if (reduce()) {
            return;
        }
        if (!bottomDragging) {
            beginBottom();
        }
        const delta = (info.dy / (genH || 1)) * 100;
        mobileBrowserSize = rubber(bottomFrom - delta, stripPct, browserMax);
    }

    function onBottomEnd(info: SwipeInfo) {
        const h = genH || 1;
        const from = bottomDragging ? bottomFrom : (mobileBrowserSize ?? stripPct);
        bottomDragging = false;
        const travel = Math.max(1, ((browserMax - stripPct) / 100) * h);
        const need = Math.min(SNAP_PX, travel * SNAP_FRAC);
        const movedPx = -info.dy;
        const startedOpen = (from - stripPct) > (browserMax - stripPct) * 0.5;
        const vOpen = -info.vy;
        let open: boolean;
        if (Math.abs(vOpen) >= FLING) {
            open = vOpen > 0;
        }
        else if (Math.abs(movedPx) >= need) {
            open = movedPx > 0;
        }
        else {
            open = startedOpen;
        }
        if (open) {
            ui.bottomOpen = true;
            browserCollapsed = false;
            lerpSize(browserMax);
        }
        else {
            lerpSize(stripPct, () => collapseBrowser());
        }
    }

    function beginSheet(which: 'params' | 'batch') {
        sheetWhich = which;
        if (which === 'params') {
            ui.paramsOpen = true;
            ui.batchOpen = false;
        }
        else {
            ui.batchOpen = true;
            ui.paramsOpen = false;
        }
        sheetDrag = true;
    }

    function progressOf(which: 'params' | 'batch', dx: number) {
        const w = panelW();
        return which === 'params'
            ? Math.min(1, Math.max(0, dx / w))
            : Math.min(1, Math.max(0, -dx / w));
    }

    function shiftOf(which: 'params' | 'batch', progress: number) {
        return sheetOff(which) * (1 - progress);
    }

    function settleSheet(which: 'params' | 'batch', progress: number, vOpen: number, startedOpen = false) {
        sheetWhich = which;
        sheetDrag = false;
        const open = wantOpen(progress, vOpen, startedOpen);
        if (reduce()) {
            sheetShift = null;
            sheetWhich = null;
            if (which === 'params') {
                ui.paramsOpen = open;
            }
            else {
                ui.batchOpen = open;
            }
            if (open) {
                closeOthers(which);
            }
            return;
        }
        if (open) {
            sheetShift = 0;
            if (which === 'params') {
                ui.paramsOpen = true;
            }
            else {
                ui.batchOpen = true;
            }
            closeOthers(which);
        }
        else {
            sheetShift = sheetOff(which);
        }
        clearTimeout(snapTimer);
        snapTimer = window.setTimeout(() => {
            if (!open) {
                if (which === 'params') {
                    ui.paramsOpen = false;
                }
                else {
                    ui.batchOpen = false;
                }
            }
            sheetShift = null;
            sheetWhich = null;
        }, SNAP);
    }

    function onMidMove(info: SwipeInfo) {
        if (!midAxis) {
            if (info.dir === 'right') {
                midAxis = 'params';
            }
            else if (info.dir === 'left') {
                midAxis = 'batch';
            }
            else if (info.dir === 'up') {
                midAxis = 'bottom';
            }
            else if (info.dir === 'down' && !browserCollapsed) {
                midAxis = 'bottom';
            }
            else {
                return;
            }
        }
        if (midAxis === 'bottom') {
            onBottomMove(info);
            return;
        }
        if (reduce()) {
            return;
        }
        beginSheet(midAxis);
        sheetShift = shiftOf(midAxis, progressOf(midAxis, info.dx));
    }

    function onMidEnd(info: SwipeInfo) {
        const which = midAxis;
        midAxis = null;
        if (!which) {
            return;
        }
        if (which === 'bottom') {
            onBottomEnd(info);
            return;
        }
        const progress = progressOf(which, info.dx);
        const vOpen = which === 'params' ? info.vx : -info.vx;
        settleSheet(which, progress, vOpen);
    }

    function onParamsDrag(info: SwipeInfo) {
        if (reduce()) {
            return;
        }
        sheetWhich = 'params';
        sheetDrag = true;
        const p = Math.min(1, Math.max(0, 1 + info.dx / panelW()));
        sheetShift = shiftOf('params', p);
    }

    function onParamsDragEnd(info: SwipeInfo) {
        settleSheet('params', Math.min(1, Math.max(0, 1 + info.dx / panelW())), info.vx, true);
    }

    function onBatchDrag(info: SwipeInfo) {
        if (reduce()) {
            return;
        }
        sheetWhich = 'batch';
        sheetDrag = true;
        const p = Math.min(1, Math.max(0, 1 - info.dx / panelW()));
        sheetShift = shiftOf('batch', p);
    }

    function onBatchDragEnd(info: SwipeInfo) {
        settleSheet('batch', Math.min(1, Math.max(0, 1 - info.dx / panelW())), -info.vx, true);
    }
</script>

{#snippet center()}
    <div class="image"><CurrentImage /></div>
{/snippet}

{#snippet top()}
    {#if ui.mobile}
        <div class="mid" use:swipe={{ onmove: onMidMove, onend: onMidEnd, enabled: ui.mobile }}>
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
        <Splitter class="mob-browser" direction="vertical" persistKey="ahaswarm.split.browser.mobile" label="Resize browser panel" dragFloor={stripH} reverse defaultSize={browserMax} min={Math.max(10, stripPct + 5)} max={browserMax} unit="%" collapsible collapseTo={stripPct} paneOverflow="hidden" toggleAlign="start" hideToggle={atTop || hasImage} expandTo={browserMax} bind:size={mobileBrowserSize} bind:collapsed={browserCollapsed} oncollapse={(c) => { ui.bottomOpen = !c; }} onYMove={onBottomMove} onYEnd={onBottomEnd} avoid={AVOID}>
            {#snippet first()}{@render top()}{/snippet}
            {#snippet second()}<BottomBar bind:stripEl open={!browserCollapsed} onopen={() => { closeOthers('bottom'); expandBrowser(); }} onclose={collapseBrowser} ondrag={onBottomMove} ondragend={onBottomEnd} />{/snippet}
        </Splitter>
    {:else}
        <Splitter direction="vertical" persistKey="ahaswarm.split.browser" label="Resize browser panel" dragFloor={36} reverse defaultSize={45} min={Math.max(10, stripPct + 5)} max={85} unit="%" collapsible collapseTo={stripPct} paneOverflow="hidden" bind:size={browserSize} bind:collapsed={browserCollapsed} avoid={AVOID}>
            {#snippet first()}{@render top()}{/snippet}
            {#snippet second()}<BottomBar bind:stripEl open={!browserCollapsed} onopen={expandBrowser} onclose={collapseBrowser} />{/snippet}
        </Splitter>
    {/if}
</div>

{#if ui.mobile && ui.page === 'generate'}
    {#if !ui.paramsOpen && !ui.batchOpen && !ui.bottomOpen && !hasImage}
        <EdgeToggle side="left" open={false} label="parameters panel" onclick={() => { closeOthers('params'); ui.paramsOpen = true; }} />
        <EdgeToggle side="right" open={false} label="batch panel" onclick={() => { closeOthers('batch'); ui.batchOpen = true; }} />
    {/if}
    <ScreenPanel bind:open={ui.paramsOpen} title="Parameters" side="left" prewarm={sheetWarm} shift={sheetWhich === 'params' ? sheetShift : null} dragging={sheetDrag && sheetWhich === 'params'} ondrag={onParamsDrag} ondragend={onParamsDragEnd}>
        <ParamPanel />
    </ScreenPanel>
    <ScreenPanel bind:open={ui.batchOpen} title="Output" side="right" prewarm={sheetWarm} shift={sheetWhich === 'batch' ? sheetShift : null} dragging={sheetDrag && sheetWhich === 'batch'} ondrag={onBatchDrag} ondragend={onBatchDragEnd}>
        <BatchPanel />
    </ScreenPanel>
{/if}

<ImageEditorModal />

<style>
    .gen { height: 100%; min-height: 0; display: flex; flex-direction: column; }
    .gen > :global(.ui-splitter) { flex: 1; min-height: 0; }
    .image { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .mid { height: 100%; min-height: 0; display: flex; flex-direction: column; touch-action: pan-x pan-y; }
    .mid .image { flex: 1; min-height: 0; }
    .gen > :global(.mob-browser) { --size-split-hit: 44px; }
</style>
