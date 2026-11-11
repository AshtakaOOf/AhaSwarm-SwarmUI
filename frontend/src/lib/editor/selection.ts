import { ctxOf, makeCanvas, type Rect } from './layer';

export type SelectionShape =
    | { kind: 'rect'; x: number; y: number; w: number; h: number }
    | { kind: 'ellipse'; x: number; y: number; w: number; h: number }
    | { kind: 'poly'; points: [number, number][] };

export class Selection {
    readonly mask: HTMLCanvasElement;

    constructor(readonly shape: SelectionShape, readonly inverted: boolean, readonly docW: number, readonly docH: number, readonly dx = 0, readonly dy = 0) {
        this.mask = makeCanvas(docW, docH);
        const ctx = ctxOf(this.mask);
        ctx.fillStyle = '#fff';
        if (inverted) {
            ctx.fillRect(0, 0, docW, docH);
            ctx.globalCompositeOperation = 'destination-out';
        }
        ctx.fill(this.path());
    }

    path(): Path2D {
        const p = new Path2D(), s = this.shape, dx = this.dx, dy = this.dy;
        if (s.kind === 'rect') {
            p.rect(s.x + dx, s.y + dy, s.w, s.h);
        }
        else if (s.kind === 'ellipse') {
            p.ellipse(s.x + dx + s.w / 2, s.y + dy + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
        }
        else {
            s.points.forEach(([x, y], i) => (i ? p.lineTo(x + dx, y + dy) : p.moveTo(x + dx, y + dy)));
            p.closePath();
        }
        return p;
    }

    bounds(): Rect {
        if (this.inverted) {
            return { x: 0, y: 0, w: this.docW, h: this.docH };
        }
        const s = this.shape;
        if (s.kind === 'poly') {
            const xs = s.points.map(p => p[0]), ys = s.points.map(p => p[1]);
            const x = Math.min(...xs), y = Math.min(...ys);
            return { x: x + this.dx, y: y + this.dy, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
        }
        return { x: Math.min(s.x, s.x + s.w) + this.dx, y: Math.min(s.y, s.y + s.h) + this.dy, w: Math.abs(s.w), h: Math.abs(s.h) };
    }

    invert(): Selection {
        return new Selection(this.shape, !this.inverted, this.docW, this.docH, this.dx, this.dy);
    }

    moved(dx: number, dy: number): Selection {
        return new Selection(this.shape, this.inverted, this.docW, this.docH, this.dx + dx, this.dy + dy);
    }

    static normalize(shape: SelectionShape): SelectionShape {
        if (shape.kind === 'poly') {
            return shape;
        }
        return { kind: shape.kind, x: Math.min(shape.x, shape.x + shape.w), y: Math.min(shape.y, shape.y + shape.h), w: Math.abs(shape.w), h: Math.abs(shape.h) };
    }
}
