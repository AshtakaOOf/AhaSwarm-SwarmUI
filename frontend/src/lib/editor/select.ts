import { pixelEntry } from './history';
import { clipRect, ctxOf, makeCanvas, type Layer, type Rect } from './layer';
import { Selection } from './selection';
import { Transform } from './transform';
import type { Editor } from './editor.svelte';

export function setSelection(this: Editor, sel: Selection | null, label: string): void {
    const before = this.selection;
    if (!before && !sel) {
        return;
    }
    this.selection = sel;
    this.hasSelection = !!sel;
    this.history.push({
        label,
        undo: () => { this.selection = before; this.hasSelection = !!before; this.render(); },
        redo: () => { this.selection = sel; this.hasSelection = !!sel; this.render(); },
    });
    this.render();
}

export function selectAll(this: Editor): void {
    this.setSelection(new Selection({ kind: 'rect', x: 0, y: 0, w: this.width, h: this.height }, false, this.width, this.height), 'Select all');
}

export function deselect(this: Editor): void {
    this.setSelection(null, 'Deselect');
}

export function invertSelection(this: Editor): void {
    if (this.selection) {
        this.setSelection(this.selection.invert(), 'Invert selection');
    }
}

export function clearSelected(this: Editor): void {
    const layer = this.active, sel = this.selection;
    if (!layer) {
        return;
    }
    this.editLayer('Clear', layer, l => {
        if (sel) {
            l.ctx.save();
            l.ctx.globalCompositeOperation = 'destination-out';
            l.ctx.drawImage(sel.mask, -l.x, -l.y);
            l.ctx.restore();
        }
        else {
            l.ctx.clearRect(0, 0, l.width, l.height);
        }
    });
}

export function fillSelected(this: Editor): void {
    const layer = this.active, sel = this.selection;
    if (!layer) {
        return;
    }
    this.editLayer('Fill', layer, l => {
        const c = makeCanvas(l.width, l.height), ctx = ctxOf(c);
        ctx.fillStyle = l.isMask ? '#ffffff' : this.color;
        ctx.fillRect(0, 0, l.width, l.height);
        if (sel) {
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(sel.mask, -l.x, -l.y);
        }
        l.ctx.drawImage(c, 0, 0);
    });
    this.rememberColor();
}

export function startTransform(this: Editor): void {
    const layer = this.active;
    if (this.xform || !layer) {
        return;
    }
    if (!layer.visible) {
        this.onNotice?.('That layer is hidden. Show it to transform it.');
        return;
    }
    this.finishText();
    this.rasterize(layer);
    const sel = this.selection;
    const area = sel ? clipRect(sel.bounds(), this.width, this.height) : null;
    const r = sel ? area && clipRect({ x: area.x - layer.x, y: area.y - layer.y, w: area.w, h: area.h }, layer.width, layer.height) : contentBounds.call(this, layer);
    if (!r) {
        this.onNotice?.(sel ? 'Nothing selected on this layer.' : 'This layer is empty.');
        return;
    }
    this.saveBackup(layer);
    const piece = makeCanvas(r.w, r.h), pctx = ctxOf(piece);
    pctx.drawImage(layer.canvas, -r.x, -r.y);
    layer.ctx.save();
    if (sel) {
        pctx.globalCompositeOperation = 'destination-in';
        pctx.drawImage(sel.mask, -r.x - layer.x, -r.y - layer.y);
        layer.ctx.globalCompositeOperation = 'destination-out';
        layer.ctx.drawImage(sel.mask, -layer.x, -layer.y);
    }
    else {
        layer.ctx.clearRect(r.x, r.y, r.w, r.h);
    }
    layer.ctx.restore();
    this.xform = new Transform(piece, r.x + layer.x, r.y + layer.y);
    this.xsession = { layer, sel };
    this.xformRev++;
    this.touch();
}

function contentBounds(this: Editor, layer: Layer): Rect | null {
    const { width: w, height: h } = layer, d = layer.ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3]) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function applyTransform(this: Editor): void {
    const t = this.xform, sess = this.xsession;
    if (!t || !sess) {
        return;
    }
    const { layer, sel } = sess;
    layer.ctx.save();
    layer.ctx.translate(-layer.x, -layer.y);
    t.draw(layer.ctx, 1);
    layer.ctx.restore();
    const rect = { x: 0, y: 0, w: layer.width, h: layer.height };
    const px = pixelEntry('Transform', layer, rect, this.backupData(rect));
    const after = sel ? new Selection({ kind: 'poly', points: t.outline(6).map(p => [p.x, p.y] as [number, number]) }, false, this.width, this.height) : null;
    this.xform = null;
    this.xsession = null;
    this.selection = after;
    this.hasSelection = !!after;
    this.history.push({
        label: 'Transform',
        undo: () => { px.undo(); this.selection = sel; this.hasSelection = !!sel; this.touch(); },
        redo: () => { px.redo(); this.selection = after; this.hasSelection = !!after; this.touch(); },
    });
    this.xformRev++;
    this.touch();
}

export function cancelTransform(this: Editor): void {
    const sess = this.xsession;
    if (!sess || !this.backup) {
        return;
    }
    sess.layer.ctx.clearRect(0, 0, sess.layer.width, sess.layer.height);
    sess.layer.ctx.drawImage(this.backup, 0, 0);
    this.xform = null;
    this.xsession = null;
    this.xformRev++;
    this.touch();
}

export function xformFlip(this: Editor, horizontal: boolean): void {
    this.xform?.flip(horizontal);
    this.xformRev++;
    this.touch();
}

export function xformRotate90(this: Editor, dir: 1 | -1): void {
    this.xform?.rotate90(dir);
    this.xformRev++;
    this.touch();
}

export function xformMesh(this: Editor, cells: number | null): void {
    this.xform?.setMesh(cells);
    this.xformRev++;
    this.touch();
}
