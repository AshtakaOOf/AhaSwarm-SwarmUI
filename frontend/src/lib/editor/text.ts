import type { Ctx, Layer, Rect } from './layer';

export interface TextStyle {
    font: string;
    size: number;
    bold: boolean;
    italic: boolean;
    align: 'left' | 'center' | 'right';
    lineHeight: number;
    strokeWidth: number;
}

export interface TextSpec extends TextStyle {
    text: string;
    color: string;
    strokeColor: string;
    /** anchor in layer pixels: the left / centre / right end (by `align`) of the first line's top */
    x: number;
    y: number;
}

export const FONTS = ['sans-serif', 'serif', 'monospace', 'cursive', 'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Trebuchet MS', 'Impact', 'Comic Sans MS'];

function fontOf(s: TextStyle): string {
    const family = /^(sans-serif|serif|monospace|cursive|fantasy)$/.test(s.font) ? s.font : `"${s.font}"`;
    return `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${s.size}px ${family}`;
}

export function textBounds(ctx: Ctx, s: TextSpec): Rect {
    ctx.save();
    ctx.font = fontOf(s);
    const lines = (s.text || ' ').split('\n');
    const width = Math.max(s.size * 0.3, ...lines.map(l => ctx.measureText(l).width));
    ctx.restore();
    const left = s.align === 'left' ? s.x : s.align === 'center' ? s.x - width / 2 : s.x - width;
    const pad = s.strokeWidth;
    return { x: left - pad, y: s.y - pad, w: width + pad * 2, h: lines.length * s.size * s.lineHeight + pad * 2 };
}

/** re-rasterizes a text layer from its spec */
export function renderText(layer: Layer): void {
    const s = layer.text;
    if (!s) {
        return;
    }
    const ctx = layer.ctx;
    ctx.clearRect(0, 0, layer.width, layer.height);
    ctx.save();
    ctx.font = fontOf(s);
    ctx.textAlign = s.align;
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    const lh = s.size * s.lineHeight;
    // the extra line height is split above and below the glyphs
    const top = s.y + (lh - s.size) / 2;
    s.text.split('\n').forEach((line, i) => {
        if (s.strokeWidth > 0) {
            ctx.strokeStyle = s.strokeColor;
            ctx.lineWidth = s.strokeWidth * 2;
            ctx.strokeText(line, s.x, top + i * lh);
        }
        ctx.fillStyle = s.color;
        ctx.fillText(line, s.x, top + i * lh);
    });
    ctx.restore();
}
