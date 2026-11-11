import { clipRect, ctxOf, makeCanvas, Layer } from './layer';
import type { Editor } from './editor.svelte';
import type { Clip } from './types';

export function copy(this: Editor, merged = false): boolean {
    const layer = this.active;
    if (!layer || this.xform) {
        return false;
    }
    this.finishText();
    const sel = this.selection;
    if (!sel && !merged) {
        copyLayer.call(this, layer);
        return true;
    }
    const r = sel ? clipRect(sel.bounds(), this.width, this.height) : { x: 0, y: 0, w: this.width, h: this.height };
    if (!r) {
        this.onNotice?.('Nothing selected.');
        return false;
    }
    const c = makeCanvas(r.w, r.h), ctx = ctxOf(c);
    const sources = merged ? this.layers.filter(l => !l.isMask && l.visible) : [layer];
    for (const l of sources) {
        ctx.globalAlpha = merged ? l.opacity : 1;
        ctx.drawImage(l.canvas, l.x - r.x, l.y - r.y);
    }
    ctx.globalAlpha = 1;
    if (sel) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(sel.mask, -r.x, -r.y);
    }
    setClip.call(this, { canvas: c, x: r.x, y: r.y, isMask: !merged && layer.isMask, name: merged ? 'Merged' : layer.name });
    return true;
}

export function copyLayer(this: Editor, layer: Layer): void {
    const c = makeCanvas(layer.width, layer.height);
    ctxOf(c).drawImage(layer.canvas, 0, 0);
    setClip.call(this, { canvas: c, x: layer.x, y: layer.y, isMask: layer.isMask, name: layer.name, text: layer.text && { ...layer.text } });
}

export function cut(this: Editor): void {
    if (this.copy()) {
        this.clearSelected();
    }
}

function setClip(this: Editor, clip: Clip): void {
    this.clip = clip;
    this.hasClipboard = true;
    this.clipMaybeStale = false;
    // also offer it to other apps; needs a secure page (https or localhost), so it's best-effort
    if (!clip.text && window.isSecureContext && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        clip.canvas.toBlob(b => { if (b) navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {}); }, 'image/png');
    }
}

export function paste(this: Editor): void {
    const clip = this.clip;
    if (!clip || this.xform) {
        return;
    }
    this.finishText();
    const l = new Layer(this.nextName(clip.text ? 'Text' : clip.isMask ? 'Mask' : 'Pasted'), clip.canvas.width, clip.canvas.height, clip.isMask);
    l.ctx.drawImage(clip.canvas, 0, 0);
    l.x = clip.x;
    l.y = clip.y;
    if (clip.text) {
        l.text = { ...clip.text };
    }
    const active = this.active;
    this.insert(l, active ? this.layers.indexOf(active) + 1 : this.layers.length);
}

export function pasteImage(this: Editor, img: CanvasImageSource & { width: number; height: number }): void {
    if (this.xform) {
        return;
    }
    this.finishText();
    this.addImageLayer(img, 'Pasted');
}

function composite(this: Editor, maskOnly: boolean): HTMLCanvasElement {
    const c = makeCanvas(this.width, this.height), ctx = ctxOf(c, true);
    for (const l of this.layers) {
        if (l.isMask === maskOnly && l.visible) {
            ctx.globalAlpha = l.opacity;
            ctx.drawImage(this.liveLayer(l), l.x, l.y);
        }
    }
    ctx.globalAlpha = 1;
    return c;
}

export function finalImage(this: Editor, type = 'image/png'): string {
    return composite.call(this, false).toDataURL(type);
}

export function fullCanvasImage(this: Editor): string {
    let x0 = 0, y0 = 0, x1 = this.width, y1 = this.height;
    for (const l of this.layers) {
        if (!l.isMask && l.visible) {
            x0 = Math.min(x0, l.x);
            y0 = Math.min(y0, l.y);
            x1 = Math.max(x1, l.x + l.width);
            y1 = Math.max(y1, l.y + l.height);
        }
    }
    const c = makeCanvas(x1 - x0, y1 - y0), ctx = ctxOf(c);
    for (const l of this.layers) {
        if (!l.isMask && l.visible) {
            ctx.globalAlpha = l.opacity;
            ctx.drawImage(this.liveLayer(l), l.x - x0, l.y - y0);
        }
    }
    return c.toDataURL('image/png');
}

export function hasMask(this: Editor): boolean {
    return this.layers.some(l => l.isMask && l.visible && l.hasContent());
}

export function finalMask(this: Editor): string {
    const w = this.width, h = this.height;
    const c = makeCanvas(w, h), ctx = ctxOf(c, true);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    if (this.hasMask) {
        const img = composite.call(this, false), ictx = ctxOf(img, true);
        const data = ictx.getImageData(0, 0, w, h);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
            d[i] = d[i + 1] = d[i + 2] = 0;
        }
        ictx.putImageData(data, 0, 0);
        ctx.drawImage(img, 0, 0);
        for (const l of this.layers) {
            if (l.isMask) {
                l.draw(ctx);
            }
        }
    }
    const out = makeCanvas(w, h), octx = ctxOf(out);
    octx.fillStyle = '#000000';
    octx.fillRect(0, 0, w, h);
    octx.globalCompositeOperation = 'luminosity';
    octx.drawImage(c, 0, 0);
    return out.toDataURL('image/png');
}

export function exportForGen(this: Editor): { image: string; mask: string } {
    if (this.exported?.rev !== this.rev) {
        this.exported = { rev: this.rev, image: finalImage.call(this), mask: finalMask.call(this) };
    }
    return this.exported;
}
