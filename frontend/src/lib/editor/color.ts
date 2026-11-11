export interface RGB { r: number; g: number; b: number }
export interface HSV { h: number; s: number; v: number }

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function hexToRgb(hex: string): RGB | null {
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) {
        h = h.split('').map(c => c + c).join('');
    }
    if (!/^[0-9a-f]{6}$/i.test(h)) {
        return null;
    }
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
    return '#' + [r, g, b].map(c => clamp255(c).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
    let h = 0;
    if (d) {
        h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
        h *= 60;
        if (h < 0) {
            h += 360;
        }
    }
    return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: clamp255((r + m) * 255), g: clamp255((g + m) * 255), b: clamp255((b + m) * 255) };
}
