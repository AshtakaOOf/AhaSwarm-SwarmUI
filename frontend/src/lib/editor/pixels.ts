import type { RGB } from './color';
import type { Ctx, Rect } from './layer';
import { LiquifyGL } from './liquifyGL';

// expand grows the fill under anti-aliased line art so it doesn't leave a light fringe
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

// each frame re-samples the untouched original so repeated pushes stay sharp.
// the displacement field is smooth at brush scale, so it lives on a grid of `step` px nodes and is
// interpolated per pixel; the image itself is still sampled at full resolution.
// drawing runs on the gpu when webgl2 is there (see liquifyGL.ts), otherwise on the cpu below
export class LiquifyWarp {
    private src32!: Uint32Array;
    private out!: Uint8ClampedArray;
    private out32!: Uint32Array;
    private gl: LiquifyGL | null = null;
    private step: number;
    private gw: number;
    private gh: number;
    // interleaved x, y displacement per grid node
    private d: Float32Array;
    private nx = new Float32Array(0);
    private ny = new Float32Array(0);
    // grid cells whose corners moved since the last flush, plus their pixel bounds
    private changed: Uint8Array;
    private pending: Rect | null = null;

    constructor(private ctx: Ctx, private w: number, private h: number, radius = 0, gpu = true) {
        this.step = Math.max(1, Math.min(4, Math.floor(radius / 48)));
        this.gw = Math.ceil(w / this.step) + 2;
        this.gh = Math.ceil(h / this.step) + 2;
        this.d = new Float32Array(this.gw * this.gh * 2);
        this.changed = new Uint8Array(this.gw * this.gh);
        if (gpu && typeof document !== 'undefined') {
            try { this.gl = new LiquifyGL(ctx.canvas, w, h, this.gw, this.gh, this.step); }
            catch { this.gl = null; }
        }
        if (!this.gl) {
            const src = ctx.getImageData(0, 0, w, h).data;
            this.src32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
            this.out = new Uint8ClampedArray(src);
            this.out32 = new Uint32Array(this.out.buffer, 0, w * h);
        }
    }

    // what to show for the layer while the stroke is live; the layer itself only changes on commit
    get view(): HTMLCanvasElement | null {
        return this.gl?.canvas ?? null;
    }

    // writes the gpu result into the layer; the cpu path already drew into it
    commit(r: Rect): void {
        if (this.gl) {
            this.ctx.clearRect(r.x, r.y, r.w, r.h);
            this.ctx.drawImage(this.gl.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
        }
    }

    dispose(): void {
        this.gl?.dispose();
        this.gl = null;
    }

    // updates the displacement field only; flush() draws the result, once per frame
    push(x0: number, y0: number, x1: number, y1: number, radius: number, strength: number): Rect | null {
        const mx = x1 - x0, my = y1 - y0;
        if (!mx && !my) {
            return null;
        }
        const g = this.step, gw = this.gw, gh = this.gh, r2 = radius * radius, inv = 1 / radius, d = this.d;
        const cx0 = Math.max(0, Math.floor((x1 - radius) / g)), cx1 = Math.min(gw - 1, Math.ceil((x1 + radius) / g));
        const cy0 = Math.max(0, Math.floor((y1 - radius) / g)), cy1 = Math.min(gh - 1, Math.ceil((y1 + radius) / g));
        if (cx1 < cx0 || cy1 < cy0 || cx0 * g >= this.w || cy0 * g >= this.h) {
            return null;
        }
        const bw = cx1 - cx0 + 1, n = bw * (cy1 - cy0 + 1);
        if (this.nx.length < n) {
            this.nx = new Float32Array(n);
            this.ny = new Float32Array(n);
        }
        const nx = this.nx, ny = this.ny, maxX = gw - 1.001, maxY = gh - 1.001, ig = 1 / g;
        // new D(q) = v + D(q - v): reads the old field, so compute into scratch first
        for (let cy = cy0; cy <= cy1; cy++) {
            const ddy = cy * g + 0.5 - y1, ddy2 = ddy * ddy;
            if (ddy2 >= r2) continue;
            for (let cx = cx0; cx <= cx1; cx++) {
                const ddx = cx * g + 0.5 - x1, d2 = ddx * ddx + ddy2;
                if (d2 >= r2) continue;
                const f = 1 - Math.sqrt(d2) * inv, wt = f * f * (3 - 2 * f) * strength;
                const vx = mx * wt, vy = my * wt;
                let sx = cx - vx * ig, sy = cy - vy * ig;
                sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
                sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
                const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, i = (iy * gw + ix) * 2, j = i + gw * 2;
                const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
                const k = (cy - cy0) * bw + cx - cx0;
                nx[k] = vx + d[i] * w00 + d[i + 2] * w10 + d[j] * w01 + d[j + 2] * w11;
                ny[k] = vy + d[i + 1] * w00 + d[i + 3] * w10 + d[j + 1] * w01 + d[j + 3] * w11;
            }
        }
        const changed = this.changed;
        let lx = Infinity, ly = Infinity, hx = -1, hy = -1;
        for (let cy = cy0; cy <= cy1; cy++) {
            const ddy = cy * g + 0.5 - y1, ddy2 = ddy * ddy;
            if (ddy2 >= r2) continue;
            for (let cx = cx0; cx <= cx1; cx++) {
                const ddx = cx * g + 0.5 - x1;
                if (ddx * ddx + ddy2 >= r2) continue;
                const k = (cy - cy0) * bw + cx - cx0, i = cy * gw + cx;
                d[i * 2] = nx[k];
                d[i * 2 + 1] = ny[k];
                // a node is a corner of the four cells around it
                changed[i] = 1;
                if (cx > 0) changed[i - 1] = 1;
                if (cy > 0) { changed[i - gw] = 1; if (cx > 0) changed[i - gw - 1] = 1; }
                if (cx < lx) lx = cx;
                if (cx > hx) hx = cx;
                if (cy < ly) ly = cy;
                if (cy > hy) hy = cy;
            }
        }
        if (hx < 0) {
            return null;
        }
        const px0 = Math.max(0, (lx - 1) * g), py0 = Math.max(0, (ly - 1) * g);
        const rect = { x: px0, y: py0, w: Math.min(this.w, (hx + 1) * g) - px0, h: Math.min(this.h, (hy + 1) * g) - py0 };
        const p = this.pending;
        this.pending = p ? { x: Math.min(p.x, rect.x), y: Math.min(p.y, rect.y), w: Math.max(p.x + p.w, rect.x + rect.w) - Math.min(p.x, rect.x), h: Math.max(p.y + p.h, rect.y + rect.h) - Math.min(p.y, rect.y) } : rect;
        return rect;
    }

    // redraws the cells pushed since the last flush and returns their bounds
    flush(): Rect | null {
        const r = this.pending;
        if (!r) {
            return null;
        }
        this.pending = null;
        const g = this.step, gw = this.gw, w = this.w, h = this.h, d = this.d, changed = this.changed;
        const cx0 = Math.floor(r.x / g), cx1 = Math.ceil((r.x + r.w) / g), cy0 = Math.floor(r.y / g), cy1 = Math.ceil((r.y + r.h) / g);
        if (this.gl) {
            for (let cy = cy0; cy < cy1; cy++) changed.fill(0, cy * gw + cx0, cy * gw + cx1);
            this.gl.draw(d, r, g);
            return r;
        }
        const ig = 1 / g, o32 = this.out32;
        for (let cy = cy0; cy < cy1; cy++) {
            for (let cx = cx0; cx < cx1; cx++) {
                const c = cy * gw + cx;
                if (!changed[c]) continue;
                changed[c] = 0;
                const i = c * 2, j = i + gw * 2;
                const x0 = d[i], x1 = d[i + 2], x2 = d[j], x3 = d[j + 2];
                const y0 = d[i + 1], y1 = d[i + 3], y2 = d[j + 1], y3 = d[j + 3];
                const pyEnd = Math.min(h, (cy + 1) * g), pxEnd = Math.min(w, (cx + 1) * g);
                for (let y = cy * g; y < pyEnd; y++) {
                    const fy = (y - cy * g) * ig, ly0 = x0 + (x2 - x0) * fy, ly1 = x1 + (x3 - x1) * fy, my0 = y0 + (y2 - y0) * fy, my1 = y1 + (y3 - y1) * fy;
                    for (let x = cx * g; x < pxEnd; x++) {
                        const fx = (x - cx * g) * ig;
                        o32[y * w + x] = this.sample(x - (ly0 + (ly1 - ly0) * fx), y - (my0 + (my1 - my0) * fx));
                    }
                }
            }
        }
        // our own copy of the layer avoids a gpu readback every frame
        const o = this.out, img = new ImageData(r.w, r.h), px = img.data;
        for (let y = 0; y < r.h; y++) {
            const s = ((r.y + y) * w + r.x) * 4;
            px.set(o.subarray(s, s + r.w * 4), y * r.w * 4);
        }
        this.ctx.putImageData(img, r.x, r.y);
        return r;
    }

    // catmull-rom, premultiplied so transparent pixels don't bleed dark edges; returns packed rgba
    private sample(sx: number, sy: number): number {
        const w = this.w, h = this.h, s32 = this.src32;
        const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
        if (fx === 0 && fy === 0 && ix >= 0 && iy >= 0 && ix < w && iy < h) {
            return s32[iy * w + ix];
        }
        const fx2 = fx * fx, fx3 = fx2 * fx, fy2 = fy * fy, fy3 = fy2 * fy;
        const a0 = (-fx3 + 2 * fx2 - fx) / 2, a1 = (3 * fx3 - 5 * fx2 + 2) / 2, a2 = (-3 * fx3 + 4 * fx2 + fx) / 2, a3 = (fx3 - fx2) / 2;
        const b0 = (-fy3 + 2 * fy2 - fy) / 2, b1 = (3 * fy3 - 5 * fy2 + 2) / 2, b2 = (-3 * fy3 + 4 * fy2 + fy) / 2, b3 = (fy3 - fy2) / 2;
        let cr = 0, cg = 0, cb = 0, ca = 0, v = 0, t = 0;
        if (ix >= 1 && iy >= 1 && ix < w - 2 && iy < h - 2) {
            const k = (iy - 1) * w + ix - 1;
            const k0 = k + w * 0;
            v = s32[k0 + 0]; t = (v >>> 24) * a0 * b0; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k0 + 1]; t = (v >>> 24) * a1 * b0; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k0 + 2]; t = (v >>> 24) * a2 * b0; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k0 + 3]; t = (v >>> 24) * a3 * b0; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            const k1 = k + w * 1;
            v = s32[k1 + 0]; t = (v >>> 24) * a0 * b1; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k1 + 1]; t = (v >>> 24) * a1 * b1; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k1 + 2]; t = (v >>> 24) * a2 * b1; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k1 + 3]; t = (v >>> 24) * a3 * b1; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            const k2 = k + w * 2;
            v = s32[k2 + 0]; t = (v >>> 24) * a0 * b2; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k2 + 1]; t = (v >>> 24) * a1 * b2; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k2 + 2]; t = (v >>> 24) * a2 * b2; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k2 + 3]; t = (v >>> 24) * a3 * b2; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            const k3 = k + w * 3;
            v = s32[k3 + 0]; t = (v >>> 24) * a0 * b3; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k3 + 1]; t = (v >>> 24) * a1 * b3; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k3 + 2]; t = (v >>> 24) * a2 * b3; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
            v = s32[k3 + 3]; t = (v >>> 24) * a3 * b3; ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
        }
        else {
            const wx = [a0, a1, a2, a3], wy = [b0, b1, b2, b3];
            for (let m = 0; m < 4; m++) {
                const yy = Math.max(0, Math.min(h - 1, iy - 1 + m));
                for (let n = 0; n < 4; n++) {
                    v = s32[yy * w + Math.max(0, Math.min(w - 1, ix - 1 + n))];
                    t = (v >>> 24) * wx[n] * wy[m];
                    ca += t; cr += (v & 255) * t; cg += ((v >>> 8) & 255) * t; cb += ((v >>> 16) & 255) * t;
                }
            }
        }
        if (ca < 0.5) {
            return 0;
        }
        const inv = 1 / ca, R = cr * inv + 0.5, G = cg * inv + 0.5, B = cb * inv + 0.5, A = ca + 0.5;
        return ((A >= 255 ? 255 : A | 0) << 24 | (B >= 255 ? 255 : B <= 0 ? 0 : B | 0) << 16 | (G >= 255 ? 255 : G <= 0 ? 0 : G | 0) << 8 | (R >= 255 ? 255 : R <= 0 ? 0 : R | 0)) >>> 0;
    }
}
