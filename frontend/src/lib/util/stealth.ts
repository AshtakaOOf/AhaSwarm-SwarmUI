// "Stealth" metadata: text hidden in the lowest bit of each pixel, so it survives services that strip normal metadata.
// SwarmUI writes it (Settings > File Format > Stealth Metadata, src/Utils/MetadataHelper.cs) and classic reads the
// alpha variant (parseMetadata in metadatahelpers.js); the format comes from the reForge / NovelAI implementation.
// Layout: a 15-byte signature, a 32-bit big-endian length in bits, then the payload (gzipped for the *comp variants).
// Bits run down each column, then across: x outer, y inner. Alpha mode uses 1 bit per pixel (alpha), RGB mode 3 (R, G, B).

const SIG_LEN = 15;
const ALPHA = ['stealth_pnginfo', 'stealth_pngcomp'];
const RGB = ['stealth_rgbinfo', 'stealth_rgbcomp'];

/** reads bytes from the hidden bit stream; `null` past the end of the image */
class BitReader {
    private x = 0;
    private y = 0;
    private ch = 0;

    constructor(private px: Uint8Array | Uint8ClampedArray, private w: number, private h: number, private rgb: boolean) {}

    private bit(): number | null {
        if (this.x >= this.w) {
            return null;
        }
        const i = (this.y * this.w + this.x) * 4;
        const b = this.rgb ? this.px[i + this.ch] & 1 : this.px[i + 3] & 1;
        if (!this.rgb || ++this.ch === 3) {
            this.ch = 0;
            if (++this.y === this.h) {
                this.y = 0;
                this.x++;
            }
        }
        return b;
    }

    bytes(n: number): Uint8Array | null {
        const out = new Uint8Array(n);
        for (let k = 0; k < n; k++) {
            let v = 0;
            for (let j = 0; j < 8; j++) {
                const b = this.bit();
                if (b === null) {
                    return null;
                }
                v = (v << 1) | b;
            }
            out[k] = v;
        }
        return out;
    }
}

async function inflate(data: Uint8Array, format: 'deflate' | 'gzip'): Promise<Uint8Array | null> {
    if (typeof DecompressionStream === 'undefined') {
        return null;
    }
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface Pixels { w: number; h: number; px: Uint8Array | Uint8ClampedArray }

/**
 * Decodes an 8-bit, non-interlaced RGB / RGBA PNG (what SwarmUI writes) straight from the file. Reading pixels back
 * through a canvas isn't exact everywhere: anti-fingerprinting (Brave, Firefox strict mode, some extensions) nudges
 * the low bits of R, G and B, which is exactly where RGB stealth metadata lives. null for anything else.
 */
async function decodePng(b: Uint8Array): Promise<Pixels | null> {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const latin = new TextDecoder('latin1');
    let w = 0, h = 0, channels = 0;
    const idat: Uint8Array[] = [];
    for (let p = 8; p + 8 <= b.length;) {
        const len = dv.getUint32(p), type = latin.decode(b.subarray(p + 4, p + 8));
        if (type === 'IHDR') {
            w = dv.getUint32(p + 8);
            h = dv.getUint32(p + 12);
            const depth = b[p + 16], colour = b[p + 17], interlace = b[p + 20];
            channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
            if (depth !== 8 || !channels || interlace !== 0) {
                return null;
            }
        }
        else if (type === 'IDAT') {
            idat.push(b.subarray(p + 8, p + 8 + len));
        }
        else if (type === 'IEND') {
            break;
        }
        p += 12 + len;
    }
    if (!w || !h || !idat.length) {
        return null;
    }
    const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
    idat.reduce((o, c) => (joined.set(c, o), o + c.length), 0);
    const raw = await inflate(joined, 'deflate');
    const stride = w * channels;
    if (!raw || raw.length < h * (stride + 1)) {
        return null;
    }
    // undo the per-row filters (PNG spec section 9), writing straight into RGBA
    const px = new Uint8Array(w * h * 4);
    let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? cur[i - channels] : 0, up = prev[i], c = i >= channels ? prev[i - channels] : 0;
            let v = row[i];
            if (f === 1) v += a;
            else if (f === 2) v += up;
            else if (f === 3) v += (a + up) >> 1;
            else if (f === 4) {
                const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
            }
            cur[i] = v;
        }
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4, i = x * channels;
            px[o] = cur[i];
            px[o + 1] = cur[i + 1];
            px[o + 2] = cur[i + 2];
            px[o + 3] = channels === 4 ? cur[i + 3] : 255;
        }
        [prev, cur] = [cur, prev];
    }
    return { w, h, px };
}

/** the browser's decode, for formats decodePng doesn't cover (WebP, 16-bit or interlaced PNG) */
async function decodeCanvas(blob: Blob): Promise<Pixels | null> {
    if (typeof createImageBitmap !== 'function') {
        return null;
    }
    // no colour management or premultiplying, so the pixel bits come back as stored where the browser allows it
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    try {
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            return null;
        }
        ctx.drawImage(bmp, 0, 0);
        return { w: bmp.width, h: bmp.height, px: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
    }
    finally {
        bmp.close();
    }
}

/** the hidden text in an image's pixels, or null when there is none. `bytes` is the file's content, if already read */
export async function readStealthMetadata(blob: Blob, bytes?: Uint8Array): Promise<string | null> {
    const b = bytes ?? new Uint8Array(await blob.arrayBuffer());
    const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const img = (isPng && await decodePng(b).catch(() => null)) || await decodeCanvas(blob);
    if (!img || img.w * img.h < 64) {
        return null;
    }
    const { w, h, px } = img;
    const latin = new TextDecoder('latin1');
    for (const rgb of [false, true]) {
        const r = new BitReader(px, w, h, rgb);
        const sig = r.bytes(SIG_LEN);
        const name = sig && latin.decode(sig);
        if (!name || !(rgb ? RGB : ALPHA).includes(name)) {
            continue;
        }
        const lenBytes = r.bytes(4);
        const bits = lenBytes ? new DataView(lenBytes.buffer).getUint32(0) : 0;
        const capacity = (w * h * (rgb ? 3 : 1)) / 8;
        if (!bits || bits % 8 || bits / 8 > capacity) {
            return null;
        }
        const payload = r.bytes(bits / 8);
        const raw = payload && (name.endsWith('comp') ? await inflate(payload, 'gzip') : payload);
        return raw ? new TextDecoder().decode(raw) : null;
    }
    return null;
}
