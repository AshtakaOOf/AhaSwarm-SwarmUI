export interface ParsedMetadata {
    params: Record<string, any>;
    extra: Record<string, any>;
    raw: any;
}

export function parseMetadata(meta: string | null | undefined): ParsedMetadata | null {
    if (!meta) {
        return null;
    }
    try {
        const raw = JSON.parse(meta);
        return {
            params: raw.sui_image_params ?? {},
            extra: raw.sui_extra_data ?? {},
            raw,
        };
    }
    catch {
        return { params: {}, extra: {}, raw: meta };
    }
}

export function fileName(path: string | null | undefined): string {
    if (!path) {
        return '';
    }
    const clean = path.split('?')[0];
    return clean.substring(clean.lastIndexOf('/') + 1);
}

export function mediaType(path: string | null | undefined): 'image' | 'video' | 'audio' {
    if (!path) {
        return 'image';
    }
    const p = path.split('?')[0].toLowerCase();
    if (p.startsWith('data:video') || /\.(mp4|webm|mov|mkv|gif_video)$/.test(p)) {
        return 'video';
    }
    if (p.startsWith('data:audio') || /\.(mp3|wav|ogg|flac|aac|m4a)$/.test(p)) {
        return 'audio';
    }
    return 'image';
}

export function formatBytes(n: number): string {
    if (!n && n !== 0) {
        return '?';
    }
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
