import { Stroke, type BrushKind } from './brush';
import { hexToRgb, rgbToHex } from './color';
import { pixelEntry } from './history';
import { clipRect, ctxOf, makeCanvas, unionRect, type Layer } from './layer';
import { floodFill, LiquifyWarp } from './pixels';
import { Selection, type SelectionShape } from './selection';
import { renderText } from './text';
import type { Editor } from './editor.svelte';
import { BRUSH_TOOLS, type Pt, type ToolId } from './types';

export function begin(this: Editor, tool: ToolId, d: Pt, e: PointerEvent): void {
    const layer = this.active;
    if (tool === 'eyedropper') {
        this.action = { kind: 'pick' };
        pick.call(this, d);
        return;
    }
    if (tool === 'text') {
        this.textClick(d);
        return;
    }
    if (tool === 'rect' || tool === 'ellipse' || tool === 'lasso') {
        this.action = { kind: 'select', shape: tool === 'lasso' ? { kind: 'poly', points: [[d.x, d.y]] } : { kind: tool, x: d.x, y: d.y, w: 0, h: 0 } };
        return;
    }
    if (!layer) {
        return;
    }
    if (tool === 'lassofill') {
        if (layer.visible) {
            this.rasterize(layer);
            this.action = { kind: 'select', shape: { kind: 'poly', points: [[d.x, d.y]] }, fill: layer };
        }
        return;
    }
    if (!layer.visible) {
        this.onNotice?.('That layer is hidden. Show it to edit it.');
        return;
    }
    if (tool !== 'move' || this.selection) {
        this.rasterize(layer);
    }
    if (tool === 'fill') {
        bucket.call(this, layer, d);
        return;
    }
    this.saveBackup(layer);
    if (BRUSH_TOOLS.includes(tool)) {
        const kind = tool as BrushKind;
        const color = layer.isMask ? '#ffffff' : this.color;
        const stroke = new Stroke(kind, $state.snapshot(this.brushes[kind]), color, layer.width, layer.height);
        stroke.add(d.x - layer.x, d.y - layer.y, this.pressure(e));
        const timer = kind === 'airbrush' ? window.setInterval(() => { stroke.tick(); this.render(); }, 40) : 0;
        this.action = { kind: 'stroke', layer, stroke, timer, touch: e.pointerType === 'touch' };
        this.rememberColor();
    }
    else if (tool === 'move') {
        let float: HTMLCanvasElement | null = null;
        if (this.selection) {
            // cut the selected pixels into a floating piece that follows the pointer
            float = makeCanvas(layer.width, layer.height);
            const fctx = ctxOf(float);
            fctx.drawImage(layer.canvas, 0, 0);
            fctx.globalCompositeOperation = 'destination-in';
            fctx.drawImage(this.selection.mask, -layer.x, -layer.y);
            layer.ctx.save();
            layer.ctx.globalCompositeOperation = 'destination-out';
            layer.ctx.drawImage(this.selection.mask, -layer.x, -layer.y);
            layer.ctx.restore();
        }
        this.action = { kind: 'move', layer, start: d, ox: layer.x, oy: layer.y, float, dx: 0, dy: 0 };
    }
    else if (tool === 'liquify') {
        this.action = { kind: 'liquify', layer, last: { x: d.x - layer.x, y: d.y - layer.y }, dirty: null, warp: new LiquifyWarp(layer.ctx, layer.width, layer.height, this.liquify.size / 2) };
    }
}

export function continueAction(this: Editor, d: Pt, e: PointerEvent): void {
    const a = this.action;
    if (!a) {
        return;
    }
    if (a.kind === 'stroke') {
        a.stroke.add(d.x - a.layer.x, d.y - a.layer.y, this.pressure(e));
    }
    else if (a.kind === 'xform') {
        this.xform?.drag(a.handle, a.snap, a.from, d, e.shiftKey);
    }
    else if (a.kind === 'textmove' && a.layer.text) {
        a.layer.text.x = a.ox + Math.round(d.x - a.start.x);
        a.layer.text.y = a.oy + Math.round(d.y - a.start.y);
        renderText(a.layer);
    }
    else if (a.kind === 'pick') {
        pick.call(this, d);
    }
    else if (a.kind === 'select') {
        const s = a.shape;
        if (s.kind === 'poly') {
            const [lx, ly] = s.points[s.points.length - 1];
            if (Math.hypot(d.x - lx, d.y - ly) * this.zoom > 3) {
                s.points.push([d.x, d.y]);
            }
        }
        else {
            s.w = d.x - s.x;
            s.h = d.y - s.y;
            if (e.shiftKey) {
                const m = Math.max(Math.abs(s.w), Math.abs(s.h));
                s.w = Math.sign(s.w || 1) * m;
                s.h = Math.sign(s.h || 1) * m;
            }
        }
    }
    else if (a.kind === 'move') {
        let dx = Math.round(d.x - a.start.x), dy = Math.round(d.y - a.start.y);
        if (e.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) dy = 0;
            else dx = 0;
        }
        a.dx = dx;
        a.dy = dy;
        if (!a.float) {
            a.layer.x = a.ox + dx;
            a.layer.y = a.oy + dy;
        }
    }
    else if (a.kind === 'liquify') {
        const p = { x: d.x - a.layer.x, y: d.y - a.layer.y };
        const r = this.liquify.size / 2, dist = Math.hypot(p.x - a.last.x, p.y - a.last.y);
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.15)));
        for (let i = 1; i <= steps; i++) {
            const from = { x: a.last.x + ((p.x - a.last.x) * (i - 1)) / steps, y: a.last.y + ((p.y - a.last.y) * (i - 1)) / steps };
            const to = { x: a.last.x + ((p.x - a.last.x) * i) / steps, y: a.last.y + ((p.y - a.last.y) * i) / steps };
            const rect = a.warp.push(from.x, from.y, to.x, to.y, r, this.liquify.strength);
            if (rect) {
                a.dirty = unionRect(a.dirty, rect);
            }
        }
        a.last = p;
    }
}

export function finish(this: Editor): void {
    const a = this.action;
    this.action = null;
    if (!a) {
        return;
    }
    if (a.kind === 'stroke') {
        window.clearInterval(a.timer);
        const clip = this.selection;
        a.stroke.apply(a.layer.ctx, clip?.mask ?? null, -a.layer.x, -a.layer.y);
        const rect = a.stroke.dirty && clipRect(a.stroke.dirty, a.layer.width, a.layer.height);
        if (rect) {
            this.commitPixels(a.stroke.kind === 'eraser' ? 'Erase' : 'Paint', a.layer, rect);
        }
    }
    else if (a.kind === 'select' && a.fill) {
        lassoFill.call(this, a.fill, a.shape);
    }
    else if (a.kind === 'select') {
        const s = Selection.normalize(a.shape);
        const tiny = s.kind === 'poly' ? s.points.length < 3 : s.w < 1 || s.h < 1;
        this.setSelection(tiny ? null : new Selection(s, false, this.width, this.height), tiny ? 'Deselect' : 'Select');
    }
    else if (a.kind === 'move') {
        if (a.float) {
            a.layer.ctx.drawImage(a.float, a.dx, a.dy);
            const before = this.selection!;
            const after = before.moved(a.dx, a.dy);
            const r = clipRect(unionRect(before.bounds(), after.bounds()), this.width, this.height);
            const rect = r && clipRect({ x: r.x - a.layer.x, y: r.y - a.layer.y, w: r.w, h: r.h }, a.layer.width, a.layer.height);
            this.selection = after;
            if (rect) {
                const px = pixelEntry('Move', a.layer, rect, this.backupData(rect));
                this.history.push({ label: 'Move', undo: () => { px.undo(); this.selection = before; this.touch(); }, redo: () => { px.redo(); this.selection = after; this.touch(); } });
            }
        }
        else if (a.dx || a.dy) {
            const { layer, ox, oy } = a, nx = layer.x, ny = layer.y;
            this.history.push({ label: 'Move layer', undo: () => { layer.x = ox; layer.y = oy; this.touch(); }, redo: () => { layer.x = nx; layer.y = ny; this.touch(); } });
        }
    }
    else if (a.kind === 'liquify') {
        a.warp.flush();
        const rect = a.dirty && clipRect(a.dirty, a.layer.width, a.layer.height);
        if (rect) {
            a.warp.commit(rect);
            this.commitPixels('Liquify', a.layer, rect);
        }
        a.warp.dispose();
    }
    this.touch();
}

export function cancelAction(this: Editor): void {
    const a = this.action;
    this.action = null;
    if (!a) {
        return;
    }
    if (a.kind === 'stroke') {
        window.clearInterval(a.timer);
    }
    if (a.kind === 'xform') {
        this.xform?.restore(a.snap);
    }
    if (a.kind === 'liquify') {
        a.warp.dispose();
    }
    if ((a.kind === 'liquify' || a.kind === 'move') && this.backup) {
        a.layer.ctx.clearRect(0, 0, a.layer.width, a.layer.height);
        a.layer.ctx.drawImage(this.backup, 0, 0);
        if (a.kind === 'move') {
            a.layer.x = a.ox;
            a.layer.y = a.oy;
        }
    }
    this.render();
}

export function pick(this: Editor, d: Pt): void {
    const c = makeCanvas(1, 1), ctx = ctxOf(c, true);
    for (const l of this.layers) {
        if (!l.isMask) {
            l.draw(ctx, -Math.floor(d.x), -Math.floor(d.y));
        }
    }
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a > 0) {
        this.color = rgbToHex({ r, g, b });
    }
}

export function layerClip(this: Editor, layer: Layer): Uint8ClampedArray | null {
    if (!this.selection) {
        return null;
    }
    const c = makeCanvas(layer.width, layer.height), ctx = ctxOf(c, true);
    ctx.drawImage(this.selection.mask, -layer.x, -layer.y);
    return ctx.getImageData(0, 0, layer.width, layer.height).data;
}

export function bucket(this: Editor, layer: Layer, d: Pt): void {
    const rgb = hexToRgb(layer.isMask ? '#ffffff' : this.color)!;
    let source: ImageData;
    if (this.fill.allLayers && !layer.isMask) {
        const c = makeCanvas(layer.width, layer.height), ctx = ctxOf(c, true);
        for (const l of this.layers) {
            if (!l.isMask) {
                l.draw(ctx, -layer.x, -layer.y);
            }
        }
        source = ctx.getImageData(0, 0, layer.width, layer.height);
    }
    else {
        source = layer.ctx.getImageData(0, 0, layer.width, layer.height);
    }
    this.saveBackup(layer);
    const rect = floodFill(source, layer.ctx, d.x - layer.x, d.y - layer.y, rgb, 1, this.fill.tolerance, layerClip.call(this, layer), this.fill.expand);
    if (rect) {
        this.commitPixels('Fill', layer, rect);
        this.rememberColor();
    }
    this.touch();
}

export function lassoFill(this: Editor, layer: Layer, shape: SelectionShape): void {
    if (shape.kind !== 'poly' || shape.points.length < 3) {
        return;
    }
    const sel = this.selection;
    this.editLayer('Lasso fill', layer, l => {
        const c = makeCanvas(l.width, l.height), ctx = ctxOf(c);
        ctx.translate(-l.x, -l.y);
        ctx.fillStyle = l.isMask ? '#ffffff' : this.color;
        ctx.fill(new Selection(shape, false, 1, 1).path());
        if (sel) {
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(sel.mask, 0, 0);
        }
        l.ctx.drawImage(c, 0, 0);
    });
    this.rememberColor();
}
