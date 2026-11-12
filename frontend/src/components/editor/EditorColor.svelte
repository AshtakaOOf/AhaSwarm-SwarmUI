<script lang="ts">
    import LArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
    import LPipette from '@lucide/svelte/icons/pipette';
    import type { Editor } from '../../lib/editor/editor.svelte';
    import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type HSV } from '../../lib/editor/color';
    import { IconButton, NumberInput, TextInput } from '../ui';

    let { editor }: { editor: Editor } = $props();

    // hsv is kept separately so hue survives dragging through black / grey
    let hsv = $state<HSV>({ h: 0, s: 0, v: 0 });
    let lastHex = '';
    $effect(() => {
        const c = editor.color.toLowerCase();
        if (c !== lastHex) {
            lastHex = c;
            const rgb = hexToRgb(c);
            if (rgb) {
                const n = rgbToHsv(rgb);
                hsv = { h: n.s === 0 || n.v === 0 ? hsv.h : n.h, s: n.v === 0 ? hsv.s : n.s, v: n.v };
            }
        }
    });
    const rgb = $derived(hexToRgb(editor.color) ?? { r: 0, g: 0, b: 0 });
    let hexText = $state('');
    $effect(() => { hexText = editor.color; });

    function setHsv(n: HSV) {
        hsv = n;
        const hex = rgbToHex(hsvToRgb(n));
        lastHex = hex;
        editor.color = hex;
    }

    function setChannel(k: 'r' | 'g' | 'b', v: number) {
        editor.color = rgbToHex({ ...rgb, [k]: v });
    }

    function drag(e: PointerEvent, apply: (fx: number, fy: number) => void) {
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
        const at = (ev: PointerEvent) => {
            const r = el.getBoundingClientRect();
            apply(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
        };
        at(e);
        const move = (ev: PointerEvent) => at(ev);
        const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
    }

    function svKey(e: KeyboardEvent) {
        const d = e.shiftKey ? 0.1 : 0.02;
        const m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
        const step = m[e.key];
        if (step) {
            e.preventDefault();
            setHsv({ ...hsv, s: Math.max(0, Math.min(1, hsv.s + step[0])), v: Math.max(0, Math.min(1, hsv.v + step[1])) });
        }
    }

    function hueKey(e: KeyboardEvent) {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
        if (d) {
            e.preventDefault();
            setHsv({ ...hsv, h: (hsv.h + d * (e.shiftKey ? 15 : 3) + 360) % 360 });
        }
    }

    function commitHex() {
        const c = hexToRgb(hexText);
        if (c) {
            editor.color = rgbToHex(c);
        }
        else {
            hexText = editor.color;
        }
    }
</script>

<div class="picker">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="sv" role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuenow={Math.round(hsv.v * 100)} aria-valuetext="saturation {Math.round(hsv.s * 100)}%, brightness {Math.round(hsv.v * 100)}%"
        style="--hue: hsl({hsv.h} 100% 50%)" onpointerdown={(e) => drag(e, (fx, fy) => setHsv({ ...hsv, s: fx, v: 1 - fy }))} onkeydown={svKey}>
        <span class="knob" style="left:{hsv.s * 100}%;top:{(1 - hsv.v) * 100}%;background:{editor.color}"></span>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="hue" role="slider" tabindex="0" aria-label="Hue" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)}
        onpointerdown={(e) => drag(e, (fx) => setHsv({ ...hsv, h: Math.min(359.9, fx * 360) }))} onkeydown={hueKey}>
        <span class="knob" style="left:{(hsv.h / 360) * 100}%"></span>
    </div>
    <div class="row">
        <div class="wells">
            <button type="button" class="well fg" style="background:{editor.color}" aria-label="Primary colour {editor.color}" title="Primary colour"></button>
            <button type="button" class="well bg" style="background:{editor.color2}" aria-label="Secondary colour {editor.color2}" title="Secondary colour (click to swap)" onclick={() => editor.swapColors()}></button>
        </div>
        <IconButton icon={LArrowLeftRight} label="Swap colours (X)" onclick={() => editor.swapColors()} />
        <IconButton icon={LPipette} label="Eyedropper (I)" pressed={editor.tool === 'eyedropper'} onclick={() => editor.setTool('eyedropper')} />
        <div class="hex"><TextInput bind:value={hexText} aria-label="Hex colour" onchange={commitHex} onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && commitHex()} /></div>
    </div>
    <div class="rgb ui-dense">
        {#each ['r', 'g', 'b'] as const as k (k)}
            <label class="ch"><span>{k.toUpperCase()}</span><NumberInput size="sm" min={0} max={255} step={1} steppers={false} ariaLabel="{k.toUpperCase()} channel" value={rgb[k]} onchange={(v: number) => setChannel(k, v)} /></label>
        {/each}
    </div>
    {#if editor.recentColors.length}
        <div class="recent" role="group" aria-label="Recent colours">
            {#each editor.recentColors as c (c)}
                <button type="button" class="sw" style="background:{c}" aria-label="Use {c}" title={c} onclick={() => (editor.color = c)}></button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .picker { display: flex; flex-direction: column; gap: var(--space-2); }
    .sv { position: relative; height: 150px; border-radius: var(--radius-sm); touch-action: none; cursor: crosshair;
        background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--hue)); }
    .hue { position: relative; height: 14px; border-radius: var(--radius-full); touch-action: none; cursor: pointer;
        background: linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00); }
    .sv:focus-visible, .hue:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
    .knob { position: absolute; width: 14px; height: 14px; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 2px #fff, 0 0 0 3px #0008; pointer-events: none; }
    .hue .knob { top: 50%; background: transparent; }
    .row { display: flex; align-items: center; gap: var(--space-1); }
    .wells { position: relative; width: 34px; height: 30px; flex: none; }
    .well { position: absolute; width: 20px; height: 20px; border-radius: var(--radius-sm); border: 0; padding: 0; box-shadow: 0 0 0 1px var(--color-border-strong), inset 0 0 0 1px #0003; cursor: pointer; }
    .well.fg { left: 0; top: 0; z-index: 1; cursor: default; }
    .well.bg { right: 0; bottom: 0; }
    .hex { flex: 1; min-width: 0; }
    .rgb { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-1); }
    .ch { display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-small); color: var(--color-ink-3); }
    .ch :global(.ui-number) { flex: 1; min-width: 0; }
    .recent { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .sw { width: 18px; height: 18px; border-radius: var(--radius-sm); border: 0; padding: 0; cursor: pointer; box-shadow: inset 0 0 0 1px #0003; }
    .sw:hover { box-shadow: 0 0 0 2px var(--color-ring); }
</style>
