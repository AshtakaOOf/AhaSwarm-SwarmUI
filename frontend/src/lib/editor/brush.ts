import { hexToRgb } from './color';
import { ctxOf, makeCanvas, unionRect, type Ctx, type Rect } from './layer';

export type BrushKind = 'brush' | 'airbrush' | 'eraser';

export interface BrushSettings {
    size: number;
    opacity: number;
    hardness: number;
    flow: number;
    pressureSize: boolean;
    pressureFlow: boolean;
}

// float coverage: 8-bit canvas alpha bands when faint airbrush dabs pile up
export class Stroke {
    readonly buffer: HTMLCanvasElement;
    readonly ctx: Ctx;
    dirty: Rect | null = null;
    private cov: Float32Array;
    private img: ImageData;
    private stale: Rect | null = null;
    private last: { x: number; y: number; p: number } | null = null;
    private carry = 0;
    private seed = 1;

    constructor(readonly kind: BrushKind, readonly s: BrushSettings, color: string, readonly w: number, readonly h: number) {
        this.buffer = makeCanvas(w, h);
        this.ctx = ctxOf(this.buffer);
        this.cov = new Float32Array(w * h);
        this.img = new ImageData(w, h);
        const { r, g, b } = hexToRgb(kind === 'eraser' ? '#000000' : color) ?? { r: 0, g: 0, b: 0 };
        const d = this.img.data;
        for (let i = 0; i < d.length; i += 4) {
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
        }
    }

    private get hardness(): number {
        return this.kind === 'airbrush' ? Math.min(this.s.hardness, 0.6) : this.s.hardness;
    }

    private get spacing(): number {
        return this.kind === 'airbrush' ? 0.05 : 0.08;
    }

    private radiusFor(p: number): number {
        const scale = this.s.pressureSize && this.kind !== 'airbrush' ? Math.max(0.05, p) : 1;
        return Math.max(0.5, (this.s.size * scale) / 2);
    }

    private step(p: number): number {
        return Math.max(0.35, this.radiusFor(p) * 2 * this.spacing);
    }

    private dab(x: number, y: number, p: number): void {
        const r = this.radiusFor(p), hard = this.hardness, inner = r * hard;
        const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(this.w, Math.ceil(x + r + 1));
        const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(this.h, Math.ceil(y + r + 1));
        if (x1 <= x0 || y1 <= y0) {
            return;
        }
        const air = this.kind === 'airbrush';
        // so one brush-width of dabs adds up to roughly `flow` coverage
        const flow = air ? 1 - Math.pow(1 - Math.min(0.999, this.s.flow * (this.s.pressureFlow ? p : 1)), this.spacing) : 1;
        // tiny brushes cover less than a pixel; scale coverage down instead of drawing a fat dot
        const small = r < 1 ? r : 1;
        for (let py = y0; py < y1; py++) {
            const dy = py + 0.5 - y, row = py * this.w;
            for (let px = x0; px < x1; px++) {
                const dx = px + 0.5 - x, dist = Math.sqrt(dx * dx + dy * dy);
                let a: number;
                if (hard >= 0.99) {
                    a = r - dist + 0.5;
                    if (a <= 0) continue;
                    if (a > 1) a = 1;
                }
                else {
                    if (dist >= r) continue;
                    a = dist <= inner ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (dist - inner)) / (r - inner));
                }
                a *= small;
                const i = row + px;
                if (air) {
                    this.cov[i] += a * flow * (1 - this.cov[i]);
                }
                else if (a > this.cov[i]) {
                    this.cov[i] = a;
                }
            }
        }
        const rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        this.dirty = unionRect(this.dirty, rect);
        this.stale = unionRect(this.stale, rect);
    }

    add(x: number, y: number, p: number): void {
        if (!this.last) {
            this.last = { x, y, p };
            this.dab(x, y, p);
            this.carry = this.step(p);
            return;
        }
        const { x: lx, y: ly, p: lp } = this.last;
        const dist = Math.hypot(x - lx, y - ly);
        if (dist < 1e-3) {
            this.last.p = p;
            return;
        }
        let t = this.carry;
        while (t <= dist) {
            const f = t / dist, pp = lp + (p - lp) * f;
            this.dab(lx + (x - lx) * f, ly + (y - ly) * f, pp);
            t += this.step(pp);
        }
        this.carry = t - dist;
        this.last = { x, y, p };
    }

    // jittered a little so a held airbrush doesn't build a hard dot
    tick(): void {
        if (this.kind !== 'airbrush' || !this.last) {
            return;
        }
        const r = this.radiusFor(this.last.p) * 0.12;
        for (let i = 0; i < 2; i++) {
            this.seed = (this.seed * 16807) % 2147483647;
            const ang = (this.seed / 2147483647) * Math.PI * 2;
            this.dab(this.last.x + Math.cos(ang) * r, this.last.y + Math.sin(ang) * r, this.last.p);
        }
    }

    flush(): void {
        const s = this.stale;
        if (!s) {
            return;
        }
        this.stale = null;
        const d = this.img.data, w = this.w;
        for (let y = s.y; y < s.y + s.h; y++) {
            for (let x = s.x; x < s.x + s.w; x++) {
                const i = y * w + x;
                d[i * 4 + 3] = this.cov[i] * 255 + 0.5;
            }
        }
        this.ctx.putImageData(this.img, 0, 0, s.x, s.y, s.w, s.h);
    }

    apply(target: Ctx, clip: HTMLCanvasElement | null, clipX: number, clipY: number): void {
        this.flush();
        if (clip) {
            this.ctx.globalCompositeOperation = 'destination-in';
            this.ctx.drawImage(clip, clipX, clipY);
            this.ctx.globalCompositeOperation = 'source-over';
        }
        target.save();
        target.globalAlpha = this.s.opacity;
        target.globalCompositeOperation = this.kind === 'eraser' ? 'destination-out' : 'source-over';
        target.drawImage(this.buffer, 0, 0);
        target.restore();
    }
}
