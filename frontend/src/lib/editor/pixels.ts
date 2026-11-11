import type { RGB } from './color';
import type { Ctx, Rect } from './layer';

/**
 * Contiguous flood fill (scanline). `source` decides which pixels match the clicked one; `target` is painted.
 * Both are layer-sized. `clip` (optional, layer-sized alpha) limits the fill to the selection. `expand` grows the
 * filled area by that many pixels so it tucks under anti-aliased line art instead of leaving a light fringe.
 */
export function floodFill(source: ImageData, target: Ctx, sx: number, sy: number, color: RGB, alpha: number, tolerance: number, clip: Uint8ClampedArray | null, expand = 0): Rect | null {
    const { width: w, height: h, data: src } = source;
    sx = Math.floor(sx);
    sy = Math.floor(sy);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) {
        return null;
    }
    const at = (sy * w + sx) * 4;
    const r0 = src[at], g0 = src[at + 1], b0 = src[at + 2], a0 = src[at + 3];
    const tol = tolerance;
    const match = (i: number) => {
        const p = i * 4;
        if (a0 === 0 && src[p + 3] === 0) {
            return true;
        }
        return Math.abs(src[p] - r0) <= tol && Math.abs(src[p + 1] - g0) <= tol && Math.abs(src[p + 2] - b0) <= tol && Math.abs(src[p + 3] - a0) <= tol;
    };
    const filled = new Uint8Array(w * h);
    const stack: number[] = [sx, sy];
    let minX = sx, maxX = sx, minY = sy, maxY = sy;
    while (stack.length) {
        const y = stack.pop()!, x0 = stack.pop()!;
        let x = x0;
        while (x > 0 && !filled[y * w + x - 1] && match(y * w + x - 1)) {
            x--;
        }
        let up = false, down = false;
        for (; x < w; x++) {
            const i = y * w + x;
            if (filled[i] || !match(i)) {
                break;
            }
            filled[i] = 255;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y > 0) {
                const m = !filled[i - w] && match(i - w);
                if (m && !up) stack.push(x, y - 1);
                up = m;
            }
            if (y < h - 1) {
                const m = !filled[i + w] && match(i + w);
                if (m && !down) stack.push(x, y + 1);
                down = m;
            }
        }
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    // grow ring by ring (alternating 8- and 4-neighbours keeps it roughly round); the outermost ring is half strength
    for (let k = 1; k <= expand; k++) {
        const x0 = Math.max(0, minX - 1), x1 = Math.min(w - 1, maxX + 1), y0 = Math.max(0, minY - 1), y1 = Math.min(h - 1, maxY + 1);
        const diag = k % 2 === 1, ring: number[] = [];
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const i = y * w + x;
                if (filled[i]) continue;
                const n = (x > 0 && filled[i - 1]) || (x < w - 1 && filled[i + 1]) || (y > 0 && filled[i - w]) || (y < h - 1 && filled[i + w])
                    || (diag && ((x > 0 && y > 0 && filled[i - w - 1]) || (x < w - 1 && y > 0 && filled[i - w + 1]) || (x > 0 && y < h - 1 && filled[i + w - 1]) || (x < w - 1 && y < h - 1 && filled[i + w + 1])));
                if (n) ring.push(i);
            }
        }
        const v = k === expand ? 128 : 255;
        for (const i of ring) {
            filled[i] = v;
        }
        minX = x0; maxX = x1; minY = y0; maxY = y1;
    }
    const rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    const out = target.getImageData(rect.x, rect.y, rect.w, rect.h);
    const d = out.data;
    for (let yy = 0; yy < rect.h; yy++) {
        for (let xx = 0; xx < rect.w; xx++) {
            const gi = (rect.y + yy) * w + rect.x + xx;
            if (!filled[gi]) {
                continue;
            }
            const a = alpha * (filled[gi] === 1 ? 1 : filled[gi] / 255) * (clip ? clip[gi * 4 + 3] / 255 : 1);
            if (a <= 0) {
                continue;
            }
            const p = (yy * rect.w + xx) * 4;
            // source-over of the fill colour on the existing pixel
            const da = d[p + 3] / 255, oa = a + da * (1 - a);
            d[p] = (color.r * a + d[p] * da * (1 - a)) / oa;
            d[p + 1] = (color.g * a + d[p + 1] * da * (1 - a)) / oa;
            d[p + 2] = (color.b * a + d[p + 2] * da * (1 - a)) / oa;
            d[p + 3] = oa * 255;
        }
    }
    target.putImageData(out, rect.x, rect.y);
    return rect;
}

/**
 * Liquify for one stroke. Pushes build up a displacement map and every frame re-samples the untouched original once,
 * so repeated pushes stay crisp instead of blurring a little more with each step.
 */
export class LiquifyWarp {
    private src: Uint8ClampedArray;
    private dx: Float32Array;
    private dy: Float32Array;

    constructor(private ctx: Ctx, private w: number, private h: number) {
        this.src = ctx.getImageData(0, 0, w, h).data;
        this.dx = new Float32Array(w * h);
        this.dy = new Float32Array(w * h);
    }

    private field(arr: Float32Array, x: number, y: number): number {
        const w = this.w;
        x = Math.max(0, Math.min(w - 1.001, x));
        y = Math.max(0, Math.min(this.h - 1.001, y));
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, i = iy * w + ix;
        return (arr[i] * (1 - fx) + arr[i + 1] * fx) * (1 - fy) + (arr[i + w] * (1 - fx) + arr[i + w + 1] * fx) * fy;
    }

    /** drags pixels under the brush from (x0,y0) towards (x1,y1), strongest in the centre */
    push(x0: number, y0: number, x1: number, y1: number, radius: number, strength: number): Rect | null {
        const mx = x1 - x0, my = y1 - y0;
        if (!mx && !my) {
            return null;
        }
        const w = this.w, r2 = radius * radius;
        const bx0 = Math.max(0, Math.floor(x1 - radius)), bx1 = Math.min(w, Math.ceil(x1 + radius));
        const by0 = Math.max(0, Math.floor(y1 - radius)), by1 = Math.min(this.h, Math.ceil(y1 + radius));
        if (bx1 <= bx0 || by1 <= by0) {
            return null;
        }
        // new D(q) = v + D(q - v): reads the old map, so compute into temporaries first
        const bw = bx1 - bx0, nx = new Float32Array(bw * (by1 - by0)), ny = new Float32Array(nx.length), hit = new Uint8Array(nx.length);
        for (let y = by0; y < by1; y++) {
            for (let x = bx0; x < bx1; x++) {
                const ddx = x + 0.5 - x1, ddy = y + 0.5 - y1, d2 = ddx * ddx + ddy * ddy;
                if (d2 >= r2) continue;
                const f = 1 - Math.sqrt(d2) / radius, wt = f * f * (3 - 2 * f) * strength;
                const vx = mx * wt, vy = my * wt, k = (y - by0) * bw + x - bx0;
                nx[k] = vx + this.field(this.dx, x - vx, y - vy);
                ny[k] = vy + this.field(this.dy, x - vx, y - vy);
                hit[k] = 1;
            }
        }
        for (let y = by0; y < by1; y++) {
            for (let x = bx0; x < bx1; x++) {
                const k = (y - by0) * bw + x - bx0;
                if (hit[k]) {
                    this.dx[y * w + x] = nx[k];
                    this.dy[y * w + x] = ny[k];
                }
            }
        }
        const rect = { x: bx0, y: by0, w: bw, h: by1 - by0 };
        this.render(rect);
        return rect;
    }

    private render(r: Rect): void {
        const w = this.w, src = this.src;
        const out = new ImageData(r.w, r.h), o = out.data;
        for (let y = r.y; y < r.y + r.h; y++) {
            for (let x = r.x; x < r.x + r.w; x++) {
                const i = y * w + x, p = ((y - r.y) * r.w + x - r.x) * 4;
                const ddx = this.dx[i], ddy = this.dy[i];
                if (!ddx && !ddy) {
                    o[p] = src[i * 4];
                    o[p + 1] = src[i * 4 + 1];
                    o[p + 2] = src[i * 4 + 2];
                    o[p + 3] = src[i * 4 + 3];
                    continue;
                }
                this.sample(x - ddx, y - ddy, o, p);
            }
        }
        this.ctx.putImageData(out, r.x, r.y);
    }

    /** bicubic (Catmull-Rom) sample of the original, premultiplied so transparent pixels don't bleed dark edges */
    private sample(sx: number, sy: number, o: Uint8ClampedArray, p: number): void {
        const w = this.w, h = this.h, src = this.src;
        const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
        const wx = cubicWeights(fx), wy = cubicWeights(fy);
        let r = 0, g = 0, b = 0, a = 0;
        for (let m = 0; m < 4; m++) {
            const yy = Math.max(0, Math.min(h - 1, iy - 1 + m)), wym = wy[m];
            for (let n = 0; n < 4; n++) {
                const xx = Math.max(0, Math.min(w - 1, ix - 1 + n)), wt = wx[n] * wym, i = (yy * w + xx) * 4;
                const al = src[i + 3] * wt;
                a += al;
                r += src[i] * al;
                g += src[i + 1] * al;
                b += src[i + 2] * al;
            }
        }
        if (a > 0.5) {
            o[p] = r / a;
            o[p + 1] = g / a;
            o[p + 2] = b / a;
        }
        o[p + 3] = a;
    }
}

function cubicWeights(t: number): [number, number, number, number] {
    const t2 = t * t, t3 = t2 * t;
    return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2];
}
