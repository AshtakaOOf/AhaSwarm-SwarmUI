
const KEYS = ['parameters', 'Parameters', 'model', 'Model', 'prompt', 'Prompt'];

async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
    if (typeof DecompressionStream === 'undefined') {
        return null;
    }
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readPng(b: Uint8Array): Promise<string | null> {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const latin = new TextDecoder('latin1'), utf8 = new TextDecoder();
    const found: Record<string, string> = {};
    let p = 8;
    while (p + 8 <= b.length) {
        const len = dv.getUint32(p);
        const type = latin.decode(b.subarray(p + 4, p + 8));
        const d = b.subarray(p + 8, p + 8 + len);
        if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
            const z = d.indexOf(0);
            const key = latin.decode(d.subarray(0, z));
            if (type === 'tEXt') {
                found[key] = latin.decode(d.subarray(z + 1));
            }
            else if (type === 'zTXt') {
                const raw = await inflate(d.subarray(z + 2));
                if (raw) {
                    found[key] = latin.decode(raw);
                }
            }
            else {
                const compressed = d[z + 1] === 1;
                let q = z + 3;
                q = d.indexOf(0, q) + 1;
                q = d.indexOf(0, q) + 1;
                const body = d.subarray(q);
                const raw = compressed ? await inflate(body) : body;
                if (raw) {
                    found[key] = utf8.decode(raw);
                }
            }
        }
        if (type === 'IEND') {
            break;
        }
        p += 12 + len;
    }
    for (const k of KEYS) {
        if (k in found) {
            return found[k];
        }
    }
    return null;
}

function readTiffUserComment(b: Uint8Array, start: number): string | null {
    const dv = new DataView(b.buffer, b.byteOffset + start, b.byteLength - start);
    const le = dv.getUint16(0) === 0x4949;
    const u16 = (o: number) => dv.getUint16(o, le), u32 = (o: number) => dv.getUint32(o, le);
    const findTag = (ifd: number, tag: number): [number, number, number] | null => {
        const n = u16(ifd);
        for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (u16(e) === tag) {
                return [u16(e + 2), u32(e + 4), e + 8];
            }
        }
        return null;
    };
    const ifd0 = u32(4);
    const exif = findTag(ifd0, 0x8769);
    const uc = exif ? findTag(u32(exif[2]), 0x9286) : null;
    if (uc) {
        const [, count, at] = uc;
        const off = count > 4 ? u32(at) : at;
        const raw = new Uint8Array(b.buffer, b.byteOffset + start + off, count);
        const prefix = new TextDecoder('latin1').decode(raw.subarray(0, 8));
        const body = raw.subarray(8);
        if (prefix.startsWith('UNICODE')) {
            const isLE = body[0] !== 0 && body[1] === 0;
            return new TextDecoder(isLE ? 'utf-16le' : 'utf-16be').decode(body);
        }
        return new TextDecoder().decode(body);
    }
    const desc = findTag(ifd0, 0x010e);
    if (desc) {
        const [, count, at] = desc;
        const off = count > 4 ? u32(at) : at;
        return new TextDecoder().decode(new Uint8Array(b.buffer, b.byteOffset + start + off, count)).replace(/\0+$/, '');
    }
    return null;
}

function readJpeg(b: Uint8Array): string | null {
    let p = 2;
    while (p + 4 < b.length && b[p] === 0xff) {
        const marker = b[p + 1];
        const len = (b[p + 2] << 8) | b[p + 3];
        if (marker === 0xe1 && new TextDecoder('latin1').decode(b.subarray(p + 4, p + 10)) === 'Exif\0\0') {
            return readTiffUserComment(b, p + 10);
        }
        if (marker === 0xda) {
            break;
        }
        p += 2 + len;
    }
    return null;
}

function readWebp(b: Uint8Array): string | null {
    const latin = new TextDecoder('latin1');
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let p = 12;
    while (p + 8 <= b.length) {
        const type = latin.decode(b.subarray(p, p + 4));
        const len = dv.getUint32(p + 4, true);
        if (type === 'EXIF') {
            let s = p + 8;
            if (latin.decode(b.subarray(s, s + 6)) === 'Exif\0\0') {
                s += 6;
            }
            return readTiffUserComment(b, s);
        }
        p += 8 + len + (len & 1);
    }
    return null;
}

export function acceptSwarmJson(text: string | null): string | null {
    const t = text?.trim();
    if (!t || !t.startsWith('{')) {
        return null;
    }
    try {
        const j = JSON.parse(t);
        return j && typeof j === 'object' && 'sui_image_params' in j ? t : null;
    }
    catch {
        return null;
    }
}

export async function readFileMetadata(file: File): Promise<string | null> {
    try {
        if (file.name.endsWith('.json') || file.type === 'application/json') {
            return acceptSwarmJson(await file.text());
        }
        const b = new Uint8Array(await file.arrayBuffer());
        let text: string | null = null;
        if (b[0] === 0x89 && b[1] === 0x50) {
            text = await readPng(b);
        }
        else if (b[0] === 0xff && b[1] === 0xd8) {
            text = readJpeg(b);
        }
        else if (new TextDecoder('latin1').decode(b.subarray(8, 12)) === 'WEBP') {
            text = readWebp(b);
        }
        return acceptSwarmJson(text);
    }
    catch {
        return null;
    }
}
