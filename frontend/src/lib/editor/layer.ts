import type { TextSpec } from './text';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
}

export function ctxOf(c: HTMLCanvasElement, readback = false): Ctx {
    return c.getContext('2d', readback ? { willReadFrequently: true } : undefined)!;
}

export interface Rect { x: number; y: number; w: number; h: number }

export function unionRect(a: Rect | null, b: Rect): Rect {
    if (!a) {
        return { ...b };
    }
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

// rounds outwards so a partial pixel is still included
export function clipRect(r: Rect, w: number, h: number): Rect | null {
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(w, Math.ceil(r.x + r.w)), y1 = Math.min(h, Math.ceil(r.y + r.h));
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

let nextId = 1;

export class Layer {
    readonly id = nextId++;
    canvas: HTMLCanvasElement;
    ctx: Ctx;
    x = 0;
    y = 0;
    opacity = 1;
    visible = true;
    // set until a pixel tool paints on it
    text: TextSpec | undefined;

    constructor(public name: string, w: number, h: number, public isMask = false) {
        this.canvas = makeCanvas(w, h);
        this.ctx = ctxOf(this.canvas, true);
    }

    get width(): number {
        return this.canvas.width;
    }

    get height(): number {
        return this.canvas.height;
    }

    clone(name: string): Layer {
        const l = new Layer(name, this.width, this.height, this.isMask);
        l.ctx.drawImage(this.canvas, 0, 0);
        l.x = this.x;
        l.y = this.y;
        l.opacity = this.opacity;
        l.visible = this.visible;
        l.text = this.text && { ...this.text };
        return l;
    }

    hasContent(): boolean {
        const d = this.ctx.getImageData(0, 0, this.width, this.height).data;
        for (let i = 3; i < d.length; i += 4) {
            if (d[i]) {
                return true;
            }
        }
        return false;
    }

    draw(ctx: Ctx, ox = 0, oy = 0): void {
        if (!this.visible || this.opacity <= 0) {
            return;
        }
        ctx.globalAlpha = this.opacity;
        ctx.drawImage(this.canvas, this.x + ox, this.y + oy);
        ctx.globalAlpha = 1;
    }
}
