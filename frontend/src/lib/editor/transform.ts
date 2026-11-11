import type { Ctx } from './layer';

export interface Pt { x: number; y: number }

export type XHandle =
    | { kind: 'move' }
    | { kind: 'scale'; hx: -1 | 0 | 1; hy: -1 | 0 | 1 }
    | { kind: 'rotate' }
    | { kind: 'point'; i: number };

interface Snapshot { cx: number; cy: number; sx: number; sy: number; rot: number; mesh: Pt[] | null }

const rotate = (p: Pt, a: number): Pt => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

function inPolygon(p: Pt, poly: Pt[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
}

function offsetTriangle(a: Pt, b: Pt, c: Pt, pad: number): [Pt, Pt, Pt] {
    const ccw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0 ? 1 : -1;
    const line = (p: Pt, q: Pt) => {
        const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
        const nx = (dy / l) * ccw, ny = (-dx / l) * ccw;
        return { p: { x: p.x + nx * pad, y: p.y + ny * pad }, d: { x: dx, y: dy } };
    };
    const meet = (l1: ReturnType<typeof line>, l2: ReturnType<typeof line>, fallback: Pt): Pt => {
        const den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
        if (Math.abs(den) < 1e-9) {
            return fallback;
        }
        const t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
        const m = { x: l1.p.x + l1.d.x * t, y: l1.p.y + l1.d.y * t };
        // very sharp corners would shoot far out; cap the mitre
        const ox = m.x - fallback.x, oy = m.y - fallback.y, ol = Math.hypot(ox, oy), cap = pad * 4;
        return ol > cap ? { x: fallback.x + (ox / ol) * cap, y: fallback.y + (oy / ol) * cap } : m;
    };
    const ab = line(a, b), bc = line(b, c), ca = line(c, a);
    return [meet(ca, ab, a), meet(ab, bc, b), meet(bc, ca, c)];
}

// classic canvas trick: texture-map a source triangle into a destination triangle
function drawTriangle(ctx: Ctx, img: HTMLCanvasElement, s: [Pt, Pt, Pt], d: [Pt, Pt, Pt], pad: number): void {
    const [s0, s1, s2] = s, [d0, d1, d2] = d;
    const dx1 = s1.x - s0.x, dy1 = s1.y - s0.y, dx2 = s2.x - s0.x, dy2 = s2.y - s0.y;
    const det = dx1 * dy2 - dx2 * dy1;
    if (!det) {
        return;
    }
    const ex1 = d1.x - d0.x, ey1 = d1.y - d0.y, ex2 = d2.x - d0.x, ey2 = d2.y - d0.y;
    const a = (ex1 * dy2 - ex2 * dy1) / det, c = (ex2 * dx1 - ex1 * dx2) / det;
    const b = (ey1 * dy2 - ey2 * dy1) / det, dd = (ey2 * dx1 - ey1 * dx2) / det;
    const e = d0.x - a * s0.x - c * s0.y, f = d0.y - b * s0.x - dd * s0.y;
    // grow the clip a pixel past every edge (offset along each edge's normal, so thin triangles grow too):
    // anti-aliased clip edges of neighbours otherwise leave faint seams
    const [g0, g1, g2] = offsetTriangle(d0, d1, d2, pad);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g0.x, g0.y);
    ctx.lineTo(g1.x, g1.y);
    ctx.lineTo(g2.x, g2.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, dd, e, f);
    const sx = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)) - 2), sy = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)) - 2);
    const sw = Math.min(img.width, Math.ceil(Math.max(s0.x, s1.x, s2.x)) + 2) - sx, sh = Math.min(img.height, Math.ceil(Math.max(s0.y, s1.y, s2.y)) + 2) - sy;
    if (sw > 0 && sh > 0) {
        ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
    }
    ctx.restore();
}

export class Transform {
    readonly w: number;
    readonly h: number;
    cx: number;
    cy: number;
    sx = 1;
    sy = 1;
    rot = 0;
    mesh: Pt[] | null = null;
    cells = 3;

    constructor(readonly piece: HTMLCanvasElement, x: number, y: number) {
        this.w = piece.width;
        this.h = piece.height;
        this.cx = x + this.w / 2;
        this.cy = y + this.h / 2;
    }

    map(p: Pt): Pt {
        const r = rotate({ x: (p.x - this.w / 2) * this.sx, y: (p.y - this.h / 2) * this.sy }, this.rot);
        return { x: r.x + this.cx, y: r.y + this.cy };
    }

    corners(): Pt[] {
        return [this.map({ x: 0, y: 0 }), this.map({ x: this.w, y: 0 }), this.map({ x: this.w, y: this.h }), this.map({ x: 0, y: this.h })];
    }

    snapshot(): Snapshot {
        return { cx: this.cx, cy: this.cy, sx: this.sx, sy: this.sy, rot: this.rot, mesh: this.mesh?.map(p => ({ ...p })) ?? null };
    }

    restore(s: Snapshot): void {
        Object.assign(this, { ...s, mesh: s.mesh?.map(p => ({ ...p })) ?? null });
    }

    setMesh(cells: number | null): void {
        if (!cells) {
            this.mesh = null;
            return;
        }
        if (this.mesh && cells === this.cells) {
            return;
        }
        // a new grid starts from the current shape (resampled if a warp already exists)
        const pts: Pt[] = [];
        for (let j = 0; j <= cells; j++) {
            for (let i = 0; i <= cells; i++) {
                pts.push(this.mesh ? this.surface(i / cells, j / cells) : this.map({ x: (i / cells) * this.w, y: (j / cells) * this.h }));
            }
        }
        this.cells = cells;
        this.mesh = pts;
    }

    private ctrl(i: number, j: number): Pt {
        const n = this.cells;
        // past the edge: extrapolate linearly so border curves stay natural
        if (i < 0) return this.lerpOut(this.ctrl(0, j), this.ctrl(1, j));
        if (i > n) return this.lerpOut(this.ctrl(n, j), this.ctrl(n - 1, j));
        if (j < 0) return this.lerpOut(this.ctrl(i, 0), this.ctrl(i, 1));
        if (j > n) return this.lerpOut(this.ctrl(i, n), this.ctrl(i, n - 1));
        return this.mesh![j * (n + 1) + i];
    }

    private lerpOut(edge: Pt, inner: Pt): Pt {
        return { x: 2 * edge.x - inner.x, y: 2 * edge.y - inner.y };
    }

    surface(u: number, v: number): Pt {
        if (!this.mesh) {
            return this.map({ x: u * this.w, y: v * this.h });
        }
        const n = this.cells, gx = u * n, gy = v * n;
        const i = Math.min(n - 1, Math.floor(gx)), j = Math.min(n - 1, Math.floor(gy)), tx = gx - i, ty = gy - j;
        const col = (jj: number): Pt => {
            const a = this.ctrl(i - 1, jj), b = this.ctrl(i, jj), c = this.ctrl(i + 1, jj), d = this.ctrl(i + 2, jj);
            return { x: catmull(a.x, b.x, c.x, d.x, tx), y: catmull(a.y, b.y, c.y, d.y, tx) };
        };
        const a = col(j - 1), b = col(j), c = col(j + 1), d = col(j + 2);
        return { x: catmull(a.x, b.x, c.x, d.x, ty), y: catmull(a.y, b.y, c.y, d.y, ty) };
    }

    outline(steps = 12): Pt[] {
        if (!this.mesh) {
            return this.corners();
        }
        const out: Pt[] = [], n = this.cells * steps;
        for (let k = 0; k < n; k++) out.push(this.surface(k / n, 0));
        for (let k = 0; k < n; k++) out.push(this.surface(1, k / n));
        for (let k = n; k > 0; k--) out.push(this.surface(k / n, 1));
        for (let k = n; k > 0; k--) out.push(this.surface(0, k / n));
        return out;
    }

    gridLines(steps = 10): Pt[][] {
        if (!this.mesh) {
            return [];
        }
        const lines: Pt[][] = [], n = this.cells;
        for (let k = 0; k <= n; k++) {
            const row: Pt[] = [], col: Pt[] = [];
            for (let s = 0; s <= n * steps; s++) {
                row.push(this.surface(s / (n * steps), k / n));
                col.push(this.surface(k / n, s / (n * steps)));
            }
            lines.push(row, col);
        }
        return lines;
    }

    draw(ctx: Ctx, pad: number): void {
        ctx.save();
        ctx.imageSmoothingQuality = 'high';
        if (!this.mesh) {
            const c = Math.cos(this.rot), s = Math.sin(this.rot);
            ctx.transform(c * this.sx, s * this.sx, -s * this.sy, c * this.sy, this.cx, this.cy);
            ctx.drawImage(this.piece, -this.w / 2, -this.h / 2);
            ctx.restore();
            return;
        }
        const r = Math.max(8, this.cells * 6), pts: Pt[] = [];
        for (let j = 0; j <= r; j++) {
            for (let i = 0; i <= r; i++) {
                pts.push(this.surface(i / r, j / r));
            }
        }
        const src = (i: number, j: number): Pt => ({ x: (i / r) * this.w, y: (j / r) * this.h });
        for (let j = 0; j < r; j++) {
            for (let i = 0; i < r; i++) {
                const p00 = pts[j * (r + 1) + i], p10 = pts[j * (r + 1) + i + 1], p01 = pts[(j + 1) * (r + 1) + i], p11 = pts[(j + 1) * (r + 1) + i + 1];
                drawTriangle(ctx, this.piece, [src(i, j), src(i + 1, j), src(i, j + 1)], [p00, p10, p01], pad);
                drawTriangle(ctx, this.piece, [src(i + 1, j), src(i + 1, j + 1), src(i, j + 1)], [p10, p11, p01], pad);
            }
        }
        ctx.restore();
    }

    hit(p: Pt, tol: number): XHandle | null {
        if (this.mesh) {
            let best = -1, bd = tol;
            this.mesh.forEach((q, i) => {
                const d = Math.hypot(q.x - p.x, q.y - p.y);
                if (d <= bd) {
                    bd = d;
                    best = i;
                }
            });
            if (best >= 0) return { kind: 'point', i: best };
            return inPolygon(p, this.outline(4)) ? { kind: 'move' } : null;
        }
        for (const hy of [-1, 0, 1] as const) {
            for (const hx of [-1, 0, 1] as const) {
                if (!hx && !hy) continue;
                const q = this.map({ x: ((hx + 1) / 2) * this.w, y: ((hy + 1) / 2) * this.h });
                if (Math.hypot(q.x - p.x, q.y - p.y) <= tol) return { kind: 'scale', hx, hy };
            }
        }
        return inPolygon(p, this.corners()) ? { kind: 'move' } : { kind: 'rotate' };
    }

    handles(): Pt[] {
        if (this.mesh) {
            return this.mesh;
        }
        const out: Pt[] = [];
        for (const hy of [-1, 0, 1]) {
            for (const hx of [-1, 0, 1]) {
                if (hx || hy) out.push(this.map({ x: ((hx + 1) / 2) * this.w, y: ((hy + 1) / 2) * this.h }));
            }
        }
        return out;
    }

    drag(h: XHandle, s: Snapshot, from: Pt, to: Pt, shift: boolean): void {
        this.restore(s);
        const dx = to.x - from.x, dy = to.y - from.y;
        if (h.kind === 'move') {
            if (this.mesh) {
                this.mesh = this.mesh.map(q => ({ x: q.x + dx, y: q.y + dy }));
            }
            else {
                this.cx += dx;
                this.cy += dy;
            }
            return;
        }
        if (h.kind === 'point' && this.mesh) {
            this.mesh[h.i] = { x: this.mesh[h.i].x + dx, y: this.mesh[h.i].y + dy };
            return;
        }
        if (h.kind === 'rotate') {
            let a = s.rot + Math.atan2(to.y - s.cy, to.x - s.cx) - Math.atan2(from.y - s.cy, from.x - s.cx);
            if (shift) {
                a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
            }
            this.rot = a;
            return;
        }
        if (h.kind !== 'scale') {
            return;
        }
        // in the box's rotated frame the edge opposite the handle stays put
        const W = Math.abs(s.sx) * this.w, H = Math.abs(s.sy) * this.h;
        const q = rotate({ x: to.x - s.cx, y: to.y - s.cy }, -s.rot);
        let w = W, hh = H;
        if (h.hx) w = (q.x + (h.hx * W) / 2) * h.hx;
        if (h.hy) hh = (q.y + (h.hy * H) / 2) * h.hy;
        if (shift && h.hx && h.hy) {
            const k = Math.max(Math.abs(w) / W, Math.abs(hh) / H);
            w = Math.sign(w || 1) * W * k;
            hh = Math.sign(hh || 1) * H * k;
        }
        const fx = h.hx ? (-h.hx * W) / 2 : 0, fy = h.hy ? (-h.hy * H) / 2 : 0;
        const centre = { x: h.hx ? fx + (h.hx * w) / 2 : 0, y: h.hy ? fy + (h.hy * hh) / 2 : 0 };
        const c = rotate(centre, s.rot);
        this.cx = s.cx + c.x;
        this.cy = s.cy + c.y;
        if (h.hx) this.sx = Math.sign(s.sx) * (w / this.w || 1e-3);
        if (h.hy) this.sy = Math.sign(s.sy) * (hh / this.h || 1e-3);
    }

    private centroid(): Pt {
        const pts = this.mesh ?? this.corners();
        return { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
    }

    flip(horizontal: boolean): void {
        if (this.mesh) {
            const c = this.centroid();
            this.mesh = this.mesh.map(p => (horizontal ? { x: 2 * c.x - p.x, y: p.y } : { x: p.x, y: 2 * c.y - p.y }));
            return;
        }
        // flip along the screen axis even when rotated: mirror = scale the matching local axis and negate the angle
        if (horizontal) this.sx = -this.sx;
        else this.sy = -this.sy;
        this.rot = -this.rot;
    }

    rotate90(dir: 1 | -1): void {
        if (this.mesh) {
            const c = this.centroid();
            this.mesh = this.mesh.map(p => { const r = rotate({ x: p.x - c.x, y: p.y - c.y }, (dir * Math.PI) / 2); return { x: r.x + c.x, y: r.y + c.y }; });
            return;
        }
        this.rot += (dir * Math.PI) / 2;
    }
}
