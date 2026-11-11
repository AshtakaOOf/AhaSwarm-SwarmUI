<script lang="ts">
    import LBold from '@lucide/svelte/icons/bold';
    import LCheck from '@lucide/svelte/icons/check';
    import LFlipH from '@lucide/svelte/icons/flip-horizontal-2';
    import LFlipV from '@lucide/svelte/icons/flip-vertical-2';
    import LItalic from '@lucide/svelte/icons/italic';
    import LRotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import LRotateCw from '@lucide/svelte/icons/rotate-cw';
    import LScaling from '@lucide/svelte/icons/scaling';
    import LX from '@lucide/svelte/icons/x';
    import type { Editor } from '../../lib/editor/editor.svelte';
    import type { BrushKind } from '../../lib/editor/brush';
    import { FONTS } from '../../lib/editor/text';
    import { Button, Dropdown, IconButton, NumberInput, SegmentedControl, Slider, Textarea, Toggle } from '../ui';
    import LAlignStart from '@lucide/svelte/icons/text-align-start';
    import LAlignCenter from '@lucide/svelte/icons/text-align-center';
    import LAlignEnd from '@lucide/svelte/icons/text-align-end';

    let { editor }: { editor: Editor } = $props();

    const MESH = [{ value: '0', label: 'Off' }, ...[2, 3, 4, 5, 6].map(n => ({ value: `${n}`, label: `${n} × ${n} grid` }))];
    const meshCells = $derived(editor.xformRev >= 0 && editor.xform?.mesh ? `${editor.xform.cells}` : '0');
    const textLayer = $derived(editor.rev >= 0 && editor.editingText !== null ? editor.editingLayer : null);
    const style = $derived(textLayer?.text ?? editor.textStyle);
    let textValue = $state('');
    $effect(() => { textValue = editor.editingText !== null ? (editor.editingLayer?.text?.text ?? '') : ''; });
    // picking a colour while editing recolours the text (primary = fill, secondary = outline)
    let lastColors: string[] | null = null;
    $effect(() => {
        const c = editor.color, c2 = editor.color2;
        if (lastColors && c !== lastColors[0]) editor.updateText({ color: c });
        if (lastColors && c2 !== lastColors[1]) editor.updateText({ strokeColor: c2 });
        lastColors = [c, c2];
    });
    function focusOnMount(node: HTMLElement) {
        node.querySelector('textarea')?.focus();
    }

    const pct = (v: number) => Math.round(v * 100);
    const isBrush = $derived(editor.tool === 'brush' || editor.tool === 'airbrush' || editor.tool === 'eraser');
    const b = $derived(isBrush ? editor.brushes[editor.tool as BrushKind] : null);
    const selTool = $derived(editor.tool === 'rect' || editor.tool === 'ellipse' || editor.tool === 'lasso');
</script>

<div class="opts">
    {#if editor.xform}
        <div class="sel">
            <IconButton icon={LFlipH} label="Flip horizontal" onclick={() => editor.xformFlip(true)} />
            <IconButton icon={LFlipV} label="Flip vertical" onclick={() => editor.xformFlip(false)} />
            <IconButton icon={LRotateCcw} label="Rotate 90° left" onclick={() => editor.xformRotate90(-1)} />
            <IconButton icon={LRotateCw} label="Rotate 90° right" onclick={() => editor.xformRotate90(1)} />
        </div>
        <div class="sl"><span class="lbl">Warp</span><Dropdown size="sm" ariaLabel="Warp grid" options={MESH} value={meshCells} onchange={(v: string) => editor.xformMesh(Number(v) || null)} /></div>
        <span class="hint">{meshCells !== '0' ? 'Drag the points to warp.' : 'Drag handles to resize (Shift keeps proportions), outside the box to rotate.'}</span>
        <div class="sel">
            <Button size="sm" icon={LX} onclick={() => editor.cancelTransform()}>Cancel</Button>
            <Button size="sm" variant="primary" icon={LCheck} onclick={() => editor.applyTransform()}>Apply</Button>
        </div>
    {:else if editor.tool === 'text'}
        {#if textLayer}
            <div class="txt" use:focusOnMount>
                <Textarea rows={2} aria-label="Text" placeholder="Type your text…" bind:value={textValue} oninput={() => editor.updateText({ text: textValue })}
                    onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); editor.finishText(); } }} />
            </div>
        {/if}
        <div class="dd"><Dropdown size="sm" ariaLabel="Font" options={FONTS.map(f => ({ value: f, label: f }))} value={style.font} onchange={(v: string) => editor.setTextStyle({ font: v })} /></div>
        <label class="num"><span>Size</span><NumberInput size="sm" ariaLabel="Font size" min={4} max={1000} step={1} value={style.size} onchange={(v: number) => editor.setTextStyle({ size: v })} /></label>
        <div class="sel">
            <IconButton icon={LBold} label="Bold" pressed={style.bold} onclick={() => editor.setTextStyle({ bold: !style.bold })} />
            <IconButton icon={LItalic} label="Italic" pressed={style.italic} onclick={() => editor.setTextStyle({ italic: !style.italic })} />
        </div>
        <SegmentedControl label="Alignment" value={style.align} onchange={(v: string) => editor.setTextStyle({ align: v as 'left' | 'center' | 'right' })}
            options={[{ value: 'left', label: '', icon: LAlignStart }, { value: 'center', label: '', icon: LAlignCenter }, { value: 'right', label: '', icon: LAlignEnd }]} />
        <div class="sl"><span class="lbl">Outline</span><Slider ariaLabel="Outline" min={0} max={40} step={1} value={style.strokeWidth} oninput={(v: number) => editor.setTextStyle({ strokeWidth: v })} onchange={(v: number) => editor.setTextStyle({ strokeWidth: v })} /></div>
        {#if textLayer}
            <Button size="sm" variant="primary" icon={LCheck} onclick={() => editor.finishText()}>Done</Button>
        {:else}
            <span class="hint">Click the canvas to add text, or click existing text to edit or drag it. The outline uses the secondary colour.</span>
        {/if}
    {:else if b}
        <div class="sl"><span class="lbl">Size</span><Slider ariaLabel="Size" min={1} max={1000} viewMax={300} step={1} scale="pot" value={b.size} oninput={(v: number) => (b.size = v)} onchange={(v: number) => (b.size = v)} /></div>
        <div class="sl"><span class="lbl">Opacity</span><Slider ariaLabel="Opacity" min={1} max={100} step={1} value={pct(b.opacity)} oninput={(v: number) => (b.opacity = v / 100)} onchange={(v: number) => (b.opacity = v / 100)} /></div>
        {#if editor.tool === 'airbrush'}
            <div class="sl"><span class="lbl">Flow</span><Slider ariaLabel="Flow" min={1} max={100} step={1} value={pct(b.flow)} oninput={(v: number) => (b.flow = v / 100)} onchange={(v: number) => (b.flow = v / 100)} /></div>
            <Toggle size="sm" label="Pressure → flow" checked={b.pressureFlow} onchange={(v: boolean) => (b.pressureFlow = v)} />
        {:else}
            <div class="sl"><span class="lbl">Hardness</span><Slider ariaLabel="Hardness" min={0} max={100} step={1} value={pct(b.hardness)} oninput={(v: number) => (b.hardness = v / 100)} onchange={(v: number) => (b.hardness = v / 100)} /></div>
            <Toggle size="sm" label="Pressure → size" checked={b.pressureSize} onchange={(v: boolean) => (b.pressureSize = v)} />
        {/if}
    {:else if editor.tool === 'fill'}
        <div class="sl"><span class="lbl">Tolerance</span><Slider ariaLabel="Tolerance" min={0} max={255} step={1} value={editor.fill.tolerance} oninput={(v: number) => (editor.fill.tolerance = v)} onchange={(v: number) => (editor.fill.tolerance = v)} /></div>
        <div class="sl"><span class="lbl">Expand</span><Slider ariaLabel="Expand" min={0} max={10} step={1} value={editor.fill.expand} oninput={(v: number) => (editor.fill.expand = v)} onchange={(v: number) => (editor.fill.expand = v)} /></div>
        <Toggle size="sm" label="Sample all layers" checked={editor.fill.allLayers} onchange={(v: boolean) => (editor.fill.allLayers = v)} />
    {:else if editor.tool === 'liquify'}
        <div class="sl"><span class="lbl">Size</span><Slider ariaLabel="Size" min={4} max={600} step={1} value={editor.liquify.size} oninput={(v: number) => (editor.liquify.size = v)} onchange={(v: number) => (editor.liquify.size = v)} /></div>
        <div class="sl"><span class="lbl">Strength</span><Slider ariaLabel="Strength" min={1} max={100} step={1} value={pct(editor.liquify.strength)} oninput={(v: number) => (editor.liquify.strength = v / 100)} onchange={(v: number) => (editor.liquify.strength = v / 100)} /></div>
    {:else if editor.tool === 'lassofill'}
        <span class="hint">Draw a shape to fill it with the primary colour.</span>
    {:else if editor.tool === 'move'}
        <span class="hint">{editor.hasSelection ? 'Drag to move the selected pixels.' : 'Drag to move the layer.'} Shift locks the direction.</span>
        <Button size="sm" icon={LScaling} onclick={() => editor.startTransform()}>Transform</Button>
    {:else if editor.tool === 'eyedropper'}
        <span class="hint">Click to pick a colour. Alt + click works with any tool.</span>
    {:else if editor.tool === 'hand'}
        <span class="hint">Drag to pan. Space + drag, middle mouse or two fingers work with any tool.</span>
    {/if}
    {#if !editor.xform && (selTool || editor.hasSelection)}
        <div class="sel">
            {#if selTool}<Button size="sm" onclick={() => editor.selectAll()}>All</Button>{/if}
            <Button size="sm" disabled={!editor.hasSelection} onclick={() => editor.deselect()}>Deselect</Button>
            <Button size="sm" disabled={!editor.hasSelection} onclick={() => editor.invertSelection()}>Invert</Button>
            <Button size="sm" icon={LScaling} disabled={!editor.hasSelection} onclick={() => editor.startTransform()}>Transform</Button>
            <Button size="sm" disabled={!editor.hasSelection} onclick={() => editor.fillSelected()}>Fill</Button>
            <Button size="sm" variant="danger" disabled={!editor.hasSelection} onclick={() => editor.clearSelected()}>Clear</Button>
        </div>
    {/if}
</div>

<style>
    .opts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-4); min-width: 0; }
    .sl { display: flex; align-items: center; gap: var(--space-2); width: 230px; }
    .sl > :global(*:last-child) { flex: 1; min-width: 0; }
    .lbl { flex: none; font-size: var(--text-small); color: var(--color-ink-2); white-space: nowrap; }
    .hint { color: var(--color-ink-3); font-size: var(--text-small); }
    .sel { display: flex; gap: var(--space-1); flex-wrap: wrap; align-items: center; }
    .dd { width: 150px; }
    .txt { flex: 1 1 260px; min-width: 200px; }
    .num { display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-small); color: var(--color-ink-3); width: 110px; }
</style>
