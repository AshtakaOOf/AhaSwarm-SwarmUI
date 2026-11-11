<script lang="ts">
    import LAlignCenter from '@lucide/svelte/icons/text-align-center';
    import LAlignEnd from '@lucide/svelte/icons/text-align-end';
    import LAlignStart from '@lucide/svelte/icons/text-align-start';
    import LBold from '@lucide/svelte/icons/bold';
    import LCheck from '@lucide/svelte/icons/check';
    import LItalic from '@lucide/svelte/icons/italic';
    import type { Editor } from '../../lib/editor/editor.svelte';
    import { FONTS } from '../../lib/editor/text';
    import { Button, Dropdown, IconButton, NumberInput, SegmentedControl, Slider, Textarea } from '../ui';

    let { editor }: { editor: Editor } = $props();

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
</script>

<div class="txt" use:focusOnMount>
    <Textarea rows={2} aria-label="Text" placeholder="Type your text…" bind:value={textValue} oninput={() => editor.updateText({ text: textValue })}
        onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); editor.finishText(); } }} />
    <div class="dd"><Dropdown size="sm" ariaLabel="Font" options={FONTS.map(f => ({ value: f, label: f }))} value={style.font} onchange={(v: string) => editor.setTextStyle({ font: v })} /></div>
    <label class="num"><span>Size</span><NumberInput size="sm" ariaLabel="Font size" min={4} max={1000} step={1} value={style.size} onchange={(v: number) => editor.setTextStyle({ size: v })} /></label>
    <div class="sel">
        <IconButton icon={LBold} label="Bold" pressed={style.bold} onclick={() => editor.setTextStyle({ bold: !style.bold })} />
        <IconButton icon={LItalic} label="Italic" pressed={style.italic} onclick={() => editor.setTextStyle({ italic: !style.italic })} />
    </div>
    <SegmentedControl label="Alignment" value={style.align} onchange={(v: string) => editor.setTextStyle({ align: v as 'left' | 'center' | 'right' })}
        options={[{ value: 'left', label: '', icon: LAlignStart }, { value: 'center', label: '', icon: LAlignCenter }, { value: 'right', label: '', icon: LAlignEnd }]} />
    <div class="sl"><span class="lbl">Outline</span><Slider ariaLabel="Outline" min={0} max={40} step={1} value={style.strokeWidth} oninput={(v: number) => editor.setTextStyle({ strokeWidth: v })} onchange={(v: number) => editor.setTextStyle({ strokeWidth: v })} /></div>
    <Button size="sm" variant="primary" icon={LCheck} onclick={() => editor.finishText()}>Done</Button>
</div>

<style>
    .txt { display: flex; flex-direction: column; align-items: stretch; gap: var(--space-2); min-width: 200px; }
    .sl { display: flex; align-items: center; gap: var(--space-2); }
    .sl > :global(*:last-child) { flex: 1; min-width: 0; }
    .lbl { flex: none; width: 64px; font-size: var(--text-small); color: var(--color-ink-2); white-space: nowrap; }
    .sel { display: flex; gap: var(--space-1); flex-wrap: wrap; align-items: center; }
    .dd { width: 100%; }
    .num { display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-small); color: var(--color-ink-3); }
</style>
