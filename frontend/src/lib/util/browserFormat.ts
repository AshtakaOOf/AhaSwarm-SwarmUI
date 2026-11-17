export const FORMATS = ['Cards', 'Small Cards', 'Big Cards', 'Thumbnails', 'Small Thumbnails', 'Big Thumbnails', 'List', 'Details List'] as const;
export type BrowserFormat = (typeof FORMATS)[number];
export const FORMAT_OPTIONS = FORMATS.map(f => ({ value: f, label: f }));

export function formatOptions(portrait = false): { value: string; label: string }[] {
    if (!portrait) {
        return FORMAT_OPTIONS;
    }
    return FORMAT_OPTIONS
        .filter(o => o.value !== 'Cards' && o.value !== 'Big Cards')
        .map(o => o.value === 'Small Cards' ? { value: o.value, label: 'Cards' } : o);
}

export function coerceFormat(f: string, portrait = false): BrowserFormat {
    if (portrait && (f === 'Cards' || f === 'Big Cards')) {
        return 'Small Cards';
    }
    return (FORMATS as readonly string[]).includes(f) ? (f as BrowserFormat) : 'Thumbnails';
}

export function loadFormat(id: string, def: BrowserFormat): BrowserFormat {
    const v = localStorage.getItem(`ahaswarm.browser.${id}.format`);
    return (FORMATS as readonly string[]).includes(v ?? '') ? (v as BrowserFormat) : def;
}
export function saveFormat(id: string, f: string) {
    localStorage.setItem(`ahaswarm.browser.${id}.format`, f);
}
export function formatClass(f: string): string {
    const kind = f.includes('Cards') ? 'cards' : f.includes('Thumbnails') ? 'thumbs' : f === 'Details List' ? 'details' : 'list';
    const size = f.startsWith('Small') ? 'small' : f.startsWith('Big') ? 'big' : 'normal';
    return `bf bf-${kind} bf-${size}`;
}
export function labelFit(f: string): { width: number; lines: number } | null {
    if (!f.includes('Thumbnails')) {
        return null;
    }
    const small = f.startsWith('Small');
    return { width: small ? 80 : f.startsWith('Big') ? 200 : 120, lines: small ? 1 : 2 };
}
export const isListFormat = (f: string) => f === 'List' || f === 'Details List';

// VirtualGrid geometry per format, in px
export function formatLayout(f: string, portrait = false): { columns: { min: number } | { width: number } | number; rowHeight: number; rowExtra?: number; gap: number; colGap: number } {
    const size = f.startsWith('Small') ? 0 : f.startsWith('Big') ? 2 : 1;
    if (f.includes('Cards')) {
        const s = portrait ? 0 : size;
        return { columns: { min: [352, 480, 640][s] }, rowHeight: [128, 160, 240][s], gap: 8, colGap: 8 };
    }
    if (f.includes('Thumbnails')) {
        if (portrait) {
            const cols = size === 0 ? 4 : size === 2 ? 2 : 3;
            return { columns: cols, rowHeight: 120, rowExtra: size === 0 ? 20 : 36, gap: 8, colGap: 8 };
        }
        const w = [80, 120, 200][size];
        // square image + name under it (one 16px line for small, two otherwise, with a 4px margin)
        return { columns: { width: w }, rowHeight: w + (size === 0 ? 20 : 36), gap: 8, colGap: 8 };
    }
    return { columns: f === 'Details List' ? 1 : { min: 240 }, rowHeight: 24, gap: 1, colGap: 8 };
}
