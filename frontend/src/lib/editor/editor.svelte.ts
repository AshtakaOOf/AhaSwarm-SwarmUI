import { type BrushKind, type BrushSettings } from './brush';
import { History, pixelEntry } from './history';
import { Layer, ctxOf, makeCanvas, type Ctx, type Rect } from './layer';
import { Selection } from './selection';
import { renderText, textBounds, type TextSpec, type TextStyle } from './text';
import type { Transform } from './transform';
import * as clipboard from './clipboard';
import * as input from './input';
import * as sel from './select';
import * as tools from './tools.svelte';
import { LiquifyGL } from './liquifyGL';
import { BRUSH_TOOLS, type Action, type Clip, type PointerInfo, type Pt, type ToolId } from './types';

export type { ToolId };

// classic ImageEditor
export class Editor {
    tool = $state<ToolId>('brush');
    color = $state('#000000');
    color2 = $state('#ffffff');
    recentColors = $state<string[]>([]);
    brushes = $state<Record<BrushKind, BrushSettings>>({
        brush: { size: 12, opacity: 1, hardness: 1, flow: 1, pressureSize: true, pressureFlow: false },
        airbrush: { size: 80, opacity: 1, hardness: 0, flow: 0.25, pressureSize: false, pressureFlow: true },
        eraser: { size: 30, opacity: 1, hardness: 1, flow: 1, pressureSize: true, pressureFlow: false },
    });
    fill = $state({ tolerance: 32, allLayers: true, expand: 2 });
    liquify = $state({ size: 90, strength: 0.5 });
    liquifyGL: LiquifyGL | null | undefined = undefined;
    layers = $state.raw<Layer[]>([]);
    activeId = $state(0);
    extraSel = $state<number[]>([]);
    anchorId = 0;
    rev = $state(0);
    canUndo = $state(false);
    canRedo = $state(false);
    zoom = $state(1);
    hasSelection = $state(false);
    width = $state(0);
    height = $state(0);
    xform = $state.raw<Transform | null>(null);
    xformRev = $state(0);
    editingText = $state<number | null>(null);
    hasClipboard = $state(false);
    textStyle = $state<TextStyle>({ font: 'sans-serif', size: 48, bold: false, italic: false, align: 'left', lineHeight: 1.2, strokeWidth: 0 });

    canvas: HTMLCanvasElement | null = null;
    ctx: Ctx | null = null;
    viewW = 0;
    viewH = 0;
    dpr = 1;
    panX = 0;
    panY = 0;
    history = new History(40, () => {
        this.canUndo = this.history.canUndo;
        this.canRedo = this.history.canRedo;
    });
    selection: Selection | null = null;
    clip: Clip | null = null;
    // set after blur so a paste prefers an image copied in another app
    clipMaybeStale = false;
    xsession: { layer: Layer; sel: Selection | null; base: HTMLCanvasElement } | null = null;
    textSession: { layer: Layer; isNew: boolean; before: TextSpec } | null = null;
    onNotice: ((msg: string) => void) | null = null;
    backup: HTMLCanvasElement | null = null;
    scratch = makeCanvas(1, 1);
    scratch2 = makeCanvas(1, 1);
    maskView = makeCanvas(1, 1);
    pointers = new Map<number, PointerInfo>();
    action: Action | null = null;
    penSeen = false;
    spaceDown = false;
    altDown = false;
    hover: Pt | null = null;
    frame = 0;
    antsTimer = 0;
    antsOffset = 0;
    checkA = '#3a3a3a';
    checkB = '#2e2e2e';
    exported: { rev: number; image: string; mask: string } | null = null;
    detach: (() => void) | null = null;

    setActive(id: number): void {
        this.activeId = id;
        this.extraSel = [];
        this.anchorId = id;
    }

    selectLayer(id: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
        const has = (x: number) => this.layers.some(l => l.id === x);
        if (mode === 'replace' || !has(this.activeId)) {
            this.setActive(id);
        }
        else if (mode === 'toggle') {
            if (id === this.activeId) {
                const rest = this.extraSel.filter(x => x !== id && has(x));
                const top = [...this.layers].reverse().find(l => rest.includes(l.id));
                if (top) {
                    this.activeId = top.id;
                    this.extraSel = rest.filter(x => x !== top.id);
                    this.anchorId = top.id;
                }
            }
            else if (this.extraSel.includes(id)) {
                this.extraSel = this.extraSel.filter(x => x !== id);
            }
            else {
                this.extraSel = [...this.extraSel, this.activeId];
                this.activeId = id;
                this.anchorId = id;
            }
        }
        else {
            const anchor = has(this.anchorId) ? this.anchorId : this.activeId;
            const a = this.layers.findIndex(l => l.id === anchor), b = this.layers.findIndex(l => l.id === id);
            if (a < 0 || b < 0) {
                this.setActive(id);
            }
            else {
                const [lo, hi] = a < b ? [a, b] : [b, a];
                this.extraSel = this.layers.slice(lo, hi + 1).map(l => l.id).filter(x => x !== id);
                this.activeId = id;
            }
        }
        this.finishText();
        this.render();
    }

    get selectedLayers(): Layer[] {
        return this.layers.filter(l => l.id === this.activeId || this.extraSel.includes(l.id));
    }

    deleteLayers(list: Layer[]): void {
        this.finishText();
        const gone = list.filter(l => this.layers.includes(l)).slice(0, this.layers.length - 1);
        if (!gone.length) {
            return;
        }
        const before = [...this.layers], prevActive = this.activeId, prevExtra = [...this.extraSel];
        const apply = () => {
            this.layers = before.filter(l => !gone.includes(l));
            this.setActive(this.layers.includes(this.active!) ? this.activeId : this.layers[this.layers.length - 1].id);
        };
        apply();
        this.history.push({
            label: gone.length > 1 ? `Delete ${gone.length} layers` : `Delete ${gone[0].name}`,
            undo: () => { this.layers = before; this.activeId = prevActive; this.extraSel = prevExtra; this.touch(); },
            redo: () => { apply(); this.touch(); },
        });
        this.touch();
    }

    get canMergeSelected(): boolean {
        const sel = this.selectedLayers;
        return sel.length > 1 && sel.every(l => l.isMask === sel[0].isMask) && sel.slice(1).some(l => l.visible);
    }

    mergeSelected(): void {
        if (!this.canMergeSelected || this.xform) {
            return;
        }
        this.finishText();
        const sel = this.selectedLayers, target = sel[0], above = sel.slice(1).filter(l => l.visible);
        this.rasterize(target);
        this.saveBackup(target);
        const rect = { x: 0, y: 0, w: target.width, h: target.height };
        const beforePx = this.backupData(rect);
        for (const l of above) {
            l.draw(target.ctx, -target.x, -target.y);
        }
        const px = pixelEntry('Merge', target, rect, beforePx);
        const before = [...this.layers], prevActive = this.activeId, prevExtra = [...this.extraSel];
        const apply = () => { this.layers = before.filter(l => !above.includes(l)); this.setActive(target.id); };
        apply();
        this.history.push({
            label: `Merge ${above.length + 1} layers`,
            undo: () => { px.undo(); this.layers = before; this.activeId = prevActive; this.extraSel = prevExtra; this.touch(); },
            redo: () => { px.redo(); apply(); this.touch(); },
        });
        this.touch();
    }

    setTool(id: ToolId): void {
        if (this.xform) {
            this.applyTransform();
        }
        if (id !== 'text') {
            this.finishText();
        }
        this.tool = id;
        this.render();
    }

    get active(): Layer | null {
        return this.layers.find(l => l.id === this.activeId) ?? null;
    }

    get brush(): BrushSettings | null {
        return BRUSH_TOOLS.includes(this.tool) ? this.brushes[this.tool as BrushKind] : null;
    }


    // classic setBaseImage
    load(img: CanvasImageSource, w: number, h: number): void {
        this.width = w;
        this.height = h;
        const base = new Layer('Image', w, h);
        base.ctx.drawImage(img, 0, 0, w, h);
        const paint = new Layer('Paint', w, h);
        const mask = new Layer('Mask', w, h, true);
        this.layers = [base, paint, mask];
        this.setActive(paint.id);
        this.selection = null;
        this.hasSelection = false;
        this.history.clear();
        this.backup = makeCanvas(w, h);
        this.maskView = makeCanvas(w, h);
        this.fit();
        this.touch();
    }

    blank(w: number, h: number, color = '#ffffff'): void {
        const c = makeCanvas(w, h), ctx = ctxOf(c);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        this.load(c, w, h);
    }

    touch(): void {
        this.layers = [...this.layers];
        this.rev++;
        this.render();
    }

    saveBackup(layer: Layer): void {
        if (!this.backup || this.backup.width !== layer.width || this.backup.height !== layer.height) {
            this.backup = makeCanvas(layer.width, layer.height);
        }
        const b = ctxOf(this.backup, true);
        b.clearRect(0, 0, layer.width, layer.height);
        b.drawImage(layer.canvas, 0, 0);
    }

    backupData(r: Rect): ImageData {
        return ctxOf(this.backup!, true).getImageData(r.x, r.y, r.w, r.h);
    }

    commitPixels(label: string, layer: Layer, rect: Rect): void {
        const px = pixelEntry(label, layer, rect, this.backupData(rect));
        this.history.push({ label, undo: () => { px.undo(); this.touch(); }, redo: () => { px.redo(); this.touch(); } });
    }

    editLayer(label: string, layer: Layer, fn: (l: Layer) => void): void {
        this.saveBackup(layer);
        fn(layer);
        this.commitPixels(label, layer, { x: 0, y: 0, w: layer.width, h: layer.height });
        this.touch();
    }

    rememberColor(): void {
        const c = this.color.toLowerCase();
        if (this.recentColors[0] !== c) {
            this.recentColors = [c, ...this.recentColors.filter(x => x !== c)].slice(0, 12);
        }
    }

    undo(): void {
        this.cancelAction();
        if (this.xform) {
            this.cancelTransform();
            return;
        }
        this.finishText();
        this.history.undo();
        this.hasSelection = !!this.selection;
        this.touch();
    }

    redo(): void {
        this.cancelAction();
        if (this.xform) {
            return;
        }
        this.finishText();
        this.history.redo();
        this.hasSelection = !!this.selection;
        this.touch();
    }

    structural(label: string, apply: () => void, revert: () => void): void {
        apply();
        this.history.push({ label, undo: () => { revert(); this.touch(); }, redo: () => { apply(); this.touch(); } });
        this.touch();
    }

    insert(layer: Layer, index = this.layers.length): void {
        const prevActive = this.activeId;
        this.structural(`Add ${layer.name}`, () => {
            const list = [...this.layers];
            list.splice(index, 0, layer);
            this.layers = list;
            this.setActive(layer.id);
        }, () => {
            this.layers = this.layers.filter(l => l !== layer);
            this.setActive(prevActive);
        });
    }

    nextName(base: string): string {
        let n = 1;
        while (this.layers.some(l => l.name === `${base} ${n}`)) {
            n++;
        }
        return `${base} ${n}`;
    }

    addLayer(mask = false): void {
        const active = this.active;
        const index = active ? this.layers.indexOf(active) + 1 : this.layers.length;
        this.insert(new Layer(this.nextName(mask ? 'Mask' : 'Layer'), this.width, this.height, mask), index);
    }

    addImageLayer(img: CanvasImageSource & { width: number; height: number }, name = 'Image'): void {
        const w = (img as HTMLImageElement).naturalWidth || img.width, h = (img as HTMLImageElement).naturalHeight || img.height;
        const l = new Layer(this.nextName(name), w, h);
        l.ctx.drawImage(img, 0, 0);
        l.x = Math.round((this.width - w) / 2);
        l.y = Math.round((this.height - h) / 2);
        const active = this.active;
        this.insert(l, active ? this.layers.indexOf(active) + 1 : this.layers.length);
    }

    duplicateLayer(layer: Layer): void {
        this.insert(layer.clone(`${layer.name} copy`), this.layers.indexOf(layer) + 1);
    }

    deleteLayer(layer: Layer): void {
        this.finishText();
        if (this.layers.length <= 1) {
            return;
        }
        const index = this.layers.indexOf(layer), prevActive = this.activeId;
        this.structural(`Delete ${layer.name}`, () => {
            this.layers = this.layers.filter(l => l !== layer);
            if (this.activeId === layer.id) {
                this.setActive(this.layers[Math.max(0, index - 1)].id);
            }
        }, () => {
            const list = [...this.layers];
            list.splice(index, 0, layer);
            this.layers = list;
            this.setActive(prevActive);
        });
    }

    moveLayer(layer: Layer, dir: 1 | -1): void {
        const i = this.layers.indexOf(layer), j = i + dir;
        if (j < 0 || j >= this.layers.length) {
            return;
        }
        const swap = () => {
            const list = [...this.layers];
            [list[i], list[j]] = [list[j], list[i]];
            this.layers = list;
        };
        this.structural('Reorder layers', swap, swap);
    }

    setLayerProps(layer: Layer, props: Partial<Pick<Layer, 'visible' | 'opacity' | 'name' | 'isMask'>>, record = true): void {
        const before = { visible: layer.visible, opacity: layer.opacity, name: layer.name, isMask: layer.isMask };
        const after = { ...before, ...props };
        if (!record) {
            Object.assign(layer, after);
            this.touch();
            return;
        }
        this.structural('Layer change', () => Object.assign(layer, after), () => Object.assign(layer, before));
    }

    commitOpacity(layer: Layer, from: number): void {
        const to = layer.opacity;
        if (from !== to) {
            this.history.push({ label: 'Opacity', undo: () => { layer.opacity = from; this.touch(); }, redo: () => { layer.opacity = to; this.touch(); } });
        }
    }

    mergeDown(layer: Layer): void {
        const i = this.layers.indexOf(layer);
        const below = this.layers[i - 1];
        if (!below || below.isMask !== layer.isMask) {
            return;
        }
        this.saveBackup(below);
        const rect = { x: 0, y: 0, w: below.width, h: below.height };
        const before = this.backupData(rect);
        layer.draw(below.ctx, -below.x, -below.y);
        const px = pixelEntry('Merge', below, rect, before);
        const apply = () => { this.layers = this.layers.filter(l => l !== layer); this.setActive(below.id); };
        apply();
        this.history.push({
            label: 'Merge down',
            undo: () => { px.undo(); const list = [...this.layers]; list.splice(i, 0, layer); this.layers = list; this.setActive(layer.id); this.touch(); },
            redo: () => { px.redo(); apply(); this.touch(); },
        });
        this.touch();
    }

    invertLayer(layer: Layer): void {
        this.editLayer(layer.isMask ? 'Invert mask' : 'Invert colours', layer, l => {
            const img = l.ctx.getImageData(0, 0, l.width, l.height), d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                if (l.isMask) {
                    d[i] = d[i + 1] = d[i + 2] = 255;
                    d[i + 3] = 255 - d[i + 3];
                }
                else {
                    d[i] = 255 - d[i];
                    d[i + 1] = 255 - d[i + 1];
                    d[i + 2] = 255 - d[i + 2];
                }
            }
            l.ctx.putImageData(img, 0, 0);
        });
    }

    clearLayer(layer: Layer): void {
        this.editLayer('Clear layer', layer, l => l.ctx.clearRect(0, 0, l.width, l.height));
    }

    rasterize(layer: Layer): void {
        const spec = layer.text;
        if (!spec) {
            return;
        }
        if (this.textSession?.layer === layer) {
            this.finishText();
        }
        layer.text = undefined;
        this.history.push({ label: 'Rasterize text', undo: () => { layer.text = { ...spec }; renderText(layer); this.touch(); }, redo: () => { layer.text = undefined; this.touch(); } });
        this.onNotice?.('Text layer converted to pixels.');
    }

    textHit(d: Pt): Layer | null {
        for (const l of [...this.layers].reverse()) {
            if (l.text && l.visible) {
                const b = textBounds(l.ctx, l.text);
                if (d.x >= b.x + l.x && d.x <= b.x + l.x + b.w && d.y >= b.y + l.y && d.y <= b.y + l.y + b.h) {
                    return l;
                }
            }
        }
        return null;
    }

    textClick(d: Pt): void {
        const hit = this.textHit(d);
        if (hit) {
            if (this.textSession?.layer !== hit) {
                this.finishText();
                this.textSession = { layer: hit, isNew: false, before: { ...hit.text! } };
            }
            this.setActive(hit.id);
            this.editingText = hit.id;
            this.color = hit.text!.color;
            this.color2 = hit.text!.strokeColor;
            this.action = { kind: 'textmove', layer: hit, start: d, ox: hit.text!.x, oy: hit.text!.y };
            this.touch();
            return;
        }
        this.finishText();
        const active = this.active;
        const layer = new Layer(this.nextName('Text'), this.width, this.height);
        layer.text = { ...$state.snapshot(this.textStyle), text: '', color: this.color, strokeColor: this.color2, x: Math.round(d.x), y: Math.round(d.y) };
        const list = [...this.layers];
        list.splice(active ? this.layers.indexOf(active) + 1 : list.length, 0, layer);
        this.layers = list;
        this.setActive(layer.id);
        this.editingText = layer.id;
        this.textSession = { layer, isNew: true, before: { ...layer.text } };
        this.rememberColor();
        this.touch();
    }

    get editingLayer(): Layer | null {
        return this.textSession?.layer ?? null;
    }

    updateText(patch: Partial<TextSpec>): void {
        const l = this.textSession?.layer;
        if (!l?.text) {
            return;
        }
        Object.assign(l.text, patch);
        renderText(l);
        this.touch();
    }

    setTextStyle(patch: Partial<TextStyle>): void {
        Object.assign(this.textStyle, patch);
        this.updateText(patch);
    }

    finishText(): void {
        const sess = this.textSession;
        this.textSession = null;
        this.editingText = null;
        if (!sess) {
            return;
        }
        const { layer, isNew, before } = sess;
        const after = layer.text ? { ...layer.text } : null;
        if (!after) {
            return;
        }
        if (isNew) {
            if (!after.text.trim()) {
                this.layers = this.layers.filter(l => l !== layer);
                if (this.activeId === layer.id) {
                    this.setActive(this.layers[this.layers.length - 1]?.id ?? 0);
                }
                this.touch();
                return;
            }
            const index = this.layers.indexOf(layer);
            this.history.push({
                label: 'Add text',
                undo: () => { this.layers = this.layers.filter(l => l !== layer); this.touch(); },
                redo: () => { const list = [...this.layers]; list.splice(index, 0, layer); this.layers = list; this.touch(); },
            });
        }
        else if (JSON.stringify(before) !== JSON.stringify(after)) {
            const set = (spec: TextSpec) => () => { layer.text = { ...spec }; renderText(layer); this.touch(); };
            this.history.push({ label: 'Edit text', undo: set(before), redo: set(after) });
        }
        this.touch();
    }

    swapColors(): void {
        [this.color, this.color2] = [this.color2, this.color];
    }

    render(): void {
        if (!this.frame) {
            this.frame = requestAnimationFrame(() => {
                this.frame = 0;
                this.renderNow();
            });
        }
    }

    liveLayer(layer: Layer): CanvasImageSource {
        const a = this.action;
        if (a?.kind === 'stroke' && a.layer === layer) {
            const s = this.sized(this.scratch, layer), ctx = ctxOf(s);
            ctx.clearRect(0, 0, s.width, s.height);
            ctx.drawImage(layer.canvas, 0, 0);
            a.stroke.flush();
            let buf: HTMLCanvasElement = a.stroke.buffer;
            if (this.selection) {
                const s2 = this.sized(this.scratch2, layer), c2 = ctxOf(s2);
                c2.clearRect(0, 0, s2.width, s2.height);
                c2.drawImage(buf, 0, 0);
                c2.globalCompositeOperation = 'destination-in';
                c2.drawImage(this.selection.mask, -layer.x, -layer.y);
                c2.globalCompositeOperation = 'source-over';
                buf = s2;
            }
            ctx.globalAlpha = a.stroke.s.opacity;
            ctx.globalCompositeOperation = a.stroke.kind === 'eraser' ? 'destination-out' : 'source-over';
            ctx.drawImage(buf, 0, 0);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            return s;
        }
        if (this.xform && this.xsession?.layer === layer) {
            const s = this.sized(this.scratch, layer), ctx = ctxOf(s);
            ctx.clearRect(0, 0, s.width, s.height);
            ctx.drawImage(this.xsession.base, 0, 0);
            ctx.save();
            ctx.translate(-layer.x, -layer.y);
            this.xform.draw(ctx, 1);
            ctx.restore();
            return s;
        }
        if (a?.kind === 'liquify' && a.layer === layer) {
            a.warp.flush();
            return a.warp.view ?? layer.canvas;
        }
        if (a?.kind === 'move' && a.float && a.layer === layer) {
            const s = this.sized(this.scratch, layer), ctx = ctxOf(s);
            ctx.clearRect(0, 0, s.width, s.height);
            ctx.drawImage(layer.canvas, 0, 0);
            ctx.drawImage(a.float, a.dx, a.dy);
            return s;
        }
        return layer.canvas;
    }

    sized(c: HTMLCanvasElement, layer: Layer): HTMLCanvasElement {
        if (c.width !== layer.width || c.height !== layer.height) {
            c.width = layer.width;
            c.height = layer.height;
        }
        return c;
    }

    renderNow(): void {
        const ctx = this.ctx;
        if (!ctx || !this.canvas) {
            return;
        }
        const z = this.zoom, dpr = this.dpr;
        this.canvas.style.cursor = this.cursor;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // the area around the picture stays see-through; the stage behind the canvas sets its colour
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.width) {
            return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const dx = this.panX, dy = this.panY, dw = this.width * z, dh = this.height * z;
        // transparency checkerboard in screen space so it stays the same size at any zoom
        ctx.save();
        ctx.beginPath();
        ctx.rect(dx, dy, dw, dh);
        ctx.clip();
        ctx.fillStyle = this.checkA;
        ctx.fillRect(dx, dy, dw, dh);
        ctx.fillStyle = this.checkB;
        const sq = 8;
        const x0 = Math.max(dx, 0), y0 = Math.max(dy, 0), x1 = Math.min(dx + dw, this.viewW), y1 = Math.min(dy + dh, this.viewH);
        for (let y = Math.floor((y0 - dy) / sq); y * sq + dy < y1; y++) {
            for (let x = Math.floor((x0 - dx) / sq) + ((Math.floor((y0 - dy) / sq) + y) % 2 ? 0 : 1) % 2; x * sq + dx < x1; x += 2) {
                ctx.fillRect(dx + x * sq, dy + y * sq, sq, sq);
            }
        }
        ctx.restore();
        ctx.save();
        ctx.translate(dx, dy);
        ctx.scale(z, z);
        ctx.imageSmoothingEnabled = z < 2;
        for (const l of this.layers) {
            if (!l.isMask && l.visible) {
                ctx.globalAlpha = l.opacity;
                if (this.xform && this.xsession?.layer === l && l.opacity === 1 && z < 2) {
                    // draw the piece straight to the screen: no layer-sized scratch pass every frame
                    ctx.drawImage(this.xsession.base, l.x, l.y);
                    this.xform.draw(ctx, Math.max(1, 1 / z));
                    continue;
                }
                ctx.drawImage(this.liveLayer(l), l.x, l.y);
            }
        }
        ctx.globalAlpha = 1;
        const masks = this.layers.filter(l => l.isMask && l.visible);
        if (masks.length) {
            // mask layers show as a tint over the picture, stronger while one is being edited
            const mv = this.maskView, mctx = ctxOf(mv);
            if (mv.width !== this.width || mv.height !== this.height) {
                mv.width = this.width;
                mv.height = this.height;
            }
            mctx.clearRect(0, 0, mv.width, mv.height);
            for (const l of masks) {
                mctx.globalAlpha = l.opacity;
                mctx.drawImage(this.liveLayer(l), l.x, l.y);
            }
            mctx.globalAlpha = 1;
            mctx.globalCompositeOperation = 'source-in';
            mctx.fillStyle = '#ff2d78';
            mctx.fillRect(0, 0, mv.width, mv.height);
            mctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = this.active?.isMask ? 0.6 : 0.35;
            ctx.drawImage(mv, 0, 0);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(Math.round(dx) - 0.5, Math.round(dy) - 0.5, Math.round(dw) + 1, Math.round(dh) + 1);
        const active = this.active;
        if (active && (active.x || active.y || active.width !== this.width || active.height !== this.height)) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.strokeRect(dx + active.x * z, dy + active.y * z, active.width * z, active.height * z);
            ctx.setLineDash([]);
        }
        const a = this.action;
        if (a?.kind === 'select' && a.fill && a.shape.kind === 'poly') {
            ctx.save();
            ctx.translate(dx, dy);
            ctx.scale(z, z);
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = a.fill.isMask ? '#ff2d78' : this.color;
            ctx.fill(new Selection(a.shape, false, 1, 1).path());
            ctx.restore();
        }
        const pending = a?.kind === 'select' && !a.fill ? new Selection(Selection.normalize(a.shape), false, 1, 1) : null;
        const sel = pending ?? this.selection;
        if (sel) {
            let path = sel.path();
            if (a?.kind === 'move' && a.float) {
                path = sel.moved(a.dx, a.dy).path();
            }
            ctx.save();
            ctx.translate(dx, dy);
            ctx.scale(z, z);
            ctx.lineWidth = 1 / z;
            ctx.strokeStyle = '#000';
            ctx.stroke(path);
            ctx.setLineDash([4 / z, 4 / z]);
            ctx.lineDashOffset = -this.antsOffset / z;
            ctx.strokeStyle = '#fff';
            ctx.stroke(path);
            ctx.restore();
        }
        if (this.xform) {
            const t = this.xform, toS = (p: Pt) => ({ x: dx + p.x * z, y: dy + p.y * z });
            ctx.save();
            ctx.lineWidth = 1;
            for (const line of t.gridLines(8)) {
                ctx.beginPath();
                line.forEach((p, i) => { const q = toS(p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            const out = t.outline(8).map(toS);
            ctx.beginPath();
            out.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
            ctx.closePath();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
            for (const hp of t.handles()) {
                const q = toS(hp);
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.beginPath();
                if (t.mesh) ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
                else ctx.rect(q.x - 4.5, q.y - 4.5, 9, 9);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        }
        const tl = this.textSession?.layer;
        if (tl?.text) {
            const b = textBounds(tl.ctx, tl.text);
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.strokeRect(dx + (b.x + tl.x) * z, dy + (b.y + tl.y) * z, b.w * z, b.h * z);
            ctx.setLineDash([]);
        }
        const h = this.hover;
        const size = this.xform ? 0 : this.brush?.size ?? (this.tool === 'liquify' ? this.liquify.size : 0);
        if (h && size && !this.spaceDown && !this.altDown && a?.kind !== 'pan') {
            const r = Math.max(1.5, (size * z) / 2);
            ctx.beginPath();
            ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }


    attach(canvas: HTMLCanvasElement): () => void { return input.attach.call(this, canvas); }
    resize(w: number, h: number): void { input.resize.call(this, w, h); }
    fit(): void { input.fit.call(this); }
    zoomBy(factor: number, at?: Pt): void { input.zoomBy.call(this, factor, at); }
    setZoom(z: number): void { input.setZoom.call(this, z); }
    setKeyState(key: 'space' | 'alt', down: boolean): void { input.setKeyState.call(this, key, down); }
    get cursor(): string { return input.cursor.call(this); }
    pressure(e: PointerEvent): number { return input.pressure.call(this, e); }

    cancelAction(): void { tools.cancelAction.call(this); }

    selectAll(): void { sel.selectAll.call(this); }
    deselect(): void { sel.deselect.call(this); }
    invertSelection(): void { sel.invertSelection.call(this); }
    clearSelected(): void { sel.clearSelected.call(this); }
    fillSelected(): void { sel.fillSelected.call(this); }
    setSelection(selection: Selection | null, label: string): void { sel.setSelection.call(this, selection, label); }
    startTransform(): void { sel.startTransform.call(this); }
    applyTransform(): void { sel.applyTransform.call(this); }
    cancelTransform(): void { sel.cancelTransform.call(this); }
    xformFlip(horizontal: boolean): void { sel.xformFlip.call(this, horizontal); }
    xformRotate90(dir: 1 | -1): void { sel.xformRotate90.call(this, dir); }
    xformMesh(cells: number | null): void { sel.xformMesh.call(this, cells); }

    copy(merged = false): boolean { return clipboard.copy.call(this, merged); }
    copyLayer(layer: Layer): void { clipboard.copyLayer.call(this, layer); }
    cut(): void { clipboard.cut.call(this); }
    paste(): void { clipboard.paste.call(this); }
    pasteImage(img: CanvasImageSource & { width: number; height: number }): void { clipboard.pasteImage.call(this, img); }
    finalImage(type = 'image/png'): string { return clipboard.finalImage.call(this, type); }
    fullCanvasImage(): string { return clipboard.fullCanvasImage.call(this); }
    get hasMask(): boolean { return clipboard.hasMask.call(this); }
    finalMask(): string { return clipboard.finalMask.call(this); }
    exportForGen(): { image: string; mask: string } { return clipboard.exportForGen.call(this); }

    ensureLiquifyGL(): LiquifyGL | null {
        if (this.liquifyGL !== undefined) return this.liquifyGL;
        try { this.liquifyGL = new LiquifyGL(); }
        catch { this.liquifyGL = null; }
        return this.liquifyGL;
    }

    destroy(): void {
        this.detach?.();
        if (this.frame) {
            cancelAnimationFrame(this.frame);
            this.frame = 0;
        }
        this.cancelAction();
        this.liquifyGL?.dispose();
        this.liquifyGL = null;
        this.layers = [];
        this.history.clear();
        this.exported = null;
    }


}
