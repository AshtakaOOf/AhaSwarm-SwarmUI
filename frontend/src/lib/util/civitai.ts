import { htmlToText } from '$ahakit';
import { api } from '../api/swarm';

export const HF = 'https://huggingface.co/';
export const CIVIT = 'https://civitai.red/';
const CIVIT_OLD = 'https://civitai.com/', CIVIT_GREEN = 'https://civitai.green/';
const SAFE = /\.(safetensors|sft|gguf)$/i;

export function normalizeCivitai(url: string): string {
    url = url.trim();
    if (url.startsWith(CIVIT_GREEN)) return CIVIT + url.slice(CIVIT_GREEN.length);
    if (url.startsWith(CIVIT_OLD)) return CIVIT + url.slice(CIVIT_OLD.length);
    return url;
}
function split(s: string, sep: string, n: number): string[] {
    const p = s.split(sep);
    return p.length <= n ? p : [...p.slice(0, n - 1), p.slice(n - 1).join(sep)];
}
export function parseCivitaiUrl(url: string): [string | null, string | null] {
    url = normalizeCivitai(url);
    let parts = split(url.slice(CIVIT.length), '/', 4);
    if (parts.length === 2 && parts[0] === 'models' && parts[1].includes('?')) { const sp = split(parts[1], '?', 2); parts = ['models', sp[0], `?${sp[1]}`]; }
    else if (parts.length === 2 && parts[0] === 'models' && !isNaN(parseInt(parts[1]))) parts = ['models', parts[1], ''];
    if (parts.length < 3) return [null, null];
    if (parts[0] === 'models') { const sp = split(parts[2], '?modelVersionId=', 2); return [parts[1], sp.length === 2 ? sp[1] : null]; }
    if (parts[0] === 'api' && ((parts[1] === 'download' && parts[2] === 'models') || (parts[1] === 'v1' && parts[2] === 'model-versions')) && parts.length >= 4) return [null, split(parts[3], '?', 2)[0]];
    return [null, null];
}
export function civitParts(url: string): string[] {
    let parts = split(normalizeCivitai(url).slice(CIVIT.length), '/', 4);
    if (parts.length === 2 && parts[0] === 'models' && parts[1].includes('?')) { const sp = split(parts[1], '?', 2); parts = ['models', sp[0], `?${sp[1]}`]; }
    else if (parts.length === 2 && parts[0] === 'models' && !isNaN(parseInt(parts[1]))) parts = ['models', parts[1], ''];
    return parts;
}

export async function imageToData(src: string, resize256 = true): Promise<string | null> {
    try {
        if (src.startsWith('https://image.civitai.com/') || src.startsWith('https://blobs-b2.civitai.com/')) {
            const r = await api.forwardImageRequest(src);
            if (!r.image) return null;
            src = r.image;
        }
        if (!resize256) return src;
        return await new Promise(res => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const ratio = Math.sqrt((256 * 256) / (img.width * img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
                c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
                res(c.toDataURL('image/jpeg'));
            };
            img.onerror = () => res(null);
            img.src = src;
        });
    }
    catch { return null; }
}

export type CivitResult = {
    raw: any; version: any; file: any; metadata: Record<string, string>; modelType: string | null; downloadUrl: string; imgUrls: string[];
    files: { id: string; label: string; url: string }[];
};
export async function getCivitaiMetadata(id: string | null, versId: string | null, opts: { validateSafe?: boolean; preloaded?: any; fileId?: string | null } = {}): Promise<CivitResult | { error: string }> {
    const validateSafe = opts.validateSafe ?? true;
    if (!id && versId && !opts.preloaded) {
        const r = await api.forwardMetadataRequest(`${CIVIT}api/v1/model-versions/${versId}`).catch(() => null);
        if (!r?.response?.modelId) return { error: '' };
        return getCivitaiMetadata(`${r.response.modelId}`, versId, opts);
    }
    let raw = opts.preloaded;
    if (!raw) {
        const r = await api.forwardMetadataRequest(`${CIVIT}api/v1/models/${id}`).catch(() => null);
        raw = r?.response;
    }
    if (!raw || !raw.modelVersions?.length) return { error: '' };
    let version = raw.modelVersions[0], file = version.files?.[0];
    outer: for (const v of raw.modelVersions) {
        for (const f of v.files ?? []) {
            if (f.type === 'Text Encoder' || f.type === 'VAE') continue;
            if (SAFE.test(f.name) && (!versId || split(f.downloadUrl || '', '?', 2)[0].endsWith(`/${versId}`))) { version = v; file = f; break outer; }
        }
    }
    if (opts.fileId) file = (version.files ?? []).find((f: any) => `${f.id}` === `${opts.fileId}`) ?? file;
    if (!file) return { error: 'That version has no files.' };
    if (validateSafe && !SAFE.test(file.name)) return { error: `Cannot download model from that URL because it is not a safetensors or GGUF file. Filename is '${file.name}'` };
    const typeId = file.type && file.type !== 'Model' ? file.type : raw.type;
    const modelType = typeId === 'Checkpoint' ? 'Stable-Diffusion' : ['LORA', 'LoCon', 'LyCORIS'].includes(typeId) ? 'LoRA' : typeId === 'TextualInversion' ? 'Embedding' : typeId === 'ControlNet' ? 'ControlNet' : typeId === 'VAE' ? 'VAE' : null;
    const imgUrls = (version.images ?? []).filter((i: any) => i.type === 'image').map((i: any) => i.url);
    let downloadUrl = file.downloadUrl;
    if (file.name.endsWith('.gguf')) downloadUrl += '#.gguf';
    const url = versId ? `${CIVIT}models/${id}?modelVersionId=${versId}` : `${CIVIT}models/${id}`;
    const metadata: Record<string, string> = {
        'modelspec.title': `${raw.name} - ${version.name}`,
        'modelspec.description': `From <a href="${url}" target="_blank">${url}</a>\n${version.description || ''}\n${raw.description}\n`,
        'modelspec.date': version.createdAt,
    };
    if (raw.creator) metadata['modelspec.author'] = raw.creator.username;
    if (version.trainedWords) metadata['modelspec.trigger_phrase'] = version.trainedWords.join('; ');
    if (raw.tags) metadata['modelspec.tags'] = raw.tags.join(', ');
    if (['Illustrious', 'Pony'].includes(version.baseModel)) metadata['modelspec.usage_hint'] = version.baseModel;
    const files = (version.files ?? []).filter((f: any) => f.type !== 'Text Encoder' && SAFE.test(f.name)).map((f: any) => ({ id: `${f.id}`, label: `${f.name} (${f.metadata?.fp ?? '?'})`, url: f.downloadUrl + (f.name.endsWith('.gguf') ? '#.gguf' : '') }));
    return { raw, version, file, metadata, modelType, downloadUrl, imgUrls, files };
}

export async function searchCivitaiForHash(hash: string): Promise<string | null> {
    if (hash.startsWith('0x')) hash = hash.slice(2);
    const r = await api.forwardMetadataRequest(`${CIVIT}api/v1/model-versions/by-hash/${hash.slice(0, 12)}`).catch(() => null);
    if (!r?.response || r.response.error) return null;
    return `${CIVIT}models/${r.response.modelId}?modelVersionId=${r.response.id}`;
}

export function civitUrlGuessFor(model: { description?: string }): string {
    const d = model.description ?? '';
    let i = d.indexOf('<a href="https://civitai.red/models/');
    if (i < 0) i = d.indexOf('<a href="https://civitai.com/models/');
    if (i < 0) return '';
    const end = d.indexOf('"', i + 9);
    if (end < 0) return '';
    let u = d.slice(i + 9, end);
    if (u.startsWith(CIVIT_OLD)) u = CIVIT + u.slice(CIVIT_OLD.length);
    return !u.includes('?modelVersionId=') || u.length > 200 || u.includes('?modelVersionId=null') ? '' : u;
}

export function asteriskMatcher(pattern: string): (t: string) => boolean {
    const parts = pattern.toLowerCase().split('*');
    return text => {
        text = text.toLowerCase();
        if (!text.startsWith(parts[0]) || !text.endsWith(parts[parts.length - 1])) return false;
        let idx = 0;
        for (const p of parts) { const f = text.indexOf(p, idx); if (f < 0) return false; idx = f + p.length; }
        return true;
    };
}
export const htmlText = htmlToText;
