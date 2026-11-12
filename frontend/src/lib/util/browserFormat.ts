export const FORMATS = ['Cards', 'Small Cards', 'Big Cards', 'Thumbnails', 'Small Thumbnails', 'Big Thumbnails', 'List', 'Details List'] as const;
export type BrowserFormat = (typeof FORMATS)[number];
export const FORMAT_OPTIONS = FORMATS.map(f => ({ value: f, label: f }));

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
export function formatLayout(f: string): { columns: { min: number } | { width: number } | number; rowHeight: number; gap: number; colGap: number } {
    const size = f.startsWith('Small') ? 0 : f.startsWith('Big') ? 2 : 1;
    if (f.includes('Cards')) {
        return { columns: { min: [352, 480, 640][size] }, rowHeight: [128, 160, 240][size], gap: 8, colGap: 8 };
    }
    if (f.includes('Thumbnails')) {
        const w = [80, 120, 200][size];
        // square image + name under it (one 16px line for small, two otherwise, with a 4px margin)
        return { columns: { width: w }, rowHeight: w + (size === 0 ? 20 : 36), gap: 8, colGap: 8 };
    }
    return { columns: f === 'Details List' ? 1 : { min: 240 }, rowHeight: 24, gap: 1, colGap: 8 };
}
