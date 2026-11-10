import { api, outputPrefix } from '../api/swarm';
import { cleanModelName, paramState } from './params.svelte';
import { gen } from './gen.svelte';
import { ui } from './ui.svelte';
import { fileName, parseMetadata } from '../util/metadata';
import { resolveUrl } from '../api/client';
import { selectModel } from './models';
import { userSettings } from './usersettings.svelte';

export function historyPath(src: string): string | null {
    if (src.startsWith('data:')) {
        return null;
    }
    let s = src.replace(/^\/+/, '');
    const prefix = outputPrefix() + '/';
    if (s.startsWith(prefix)) {
        s = s.substring(prefix.length);
    }
    else if (s.startsWith('View/')) {
        s = s.split('/').slice(2).join('/');
    }
    else if (s.startsWith('Output/')) {
        s = s.substring('Output/'.length);
    }
    return decodeURIComponent(s.split('?')[0]);
}

/** classic copy_current_image_params */
export function reuseParams(metadata: string | null): void {
    const meta = parseMetadata(metadata);
    if (!meta || !Object.keys(meta.params).length) {
        ui.toast('No parameters to copy!', 'warning');
        return;
    }
    const applied = paramState.reuseMetadata(meta.raw);
    if (paramState.values['model']) {
        selectModel(`${paramState.values['model']}`);
    }
    ui.toast(`Reused ${applied.length} parameters.`, 'success');
    ui.go('generate');
}

async function toDataUrl(src: string): Promise<string> {
    if (src.startsWith('data:')) {
        return src;
    }
    const blob = await (await fetch(resolveUrl(src))).blob();
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}

function naturalSize(dataUrl: string): Promise<[number, number]> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
        img.onerror = () => resolve([0, 0]);
        img.src = dataUrl;
    });
}

export async function useAsInit(src: string): Promise<void> {
    const p = paramState.byId['initimage'];
    if (!p) {
        ui.toast('Init Image parameter not found (custom workflow?).', 'warning');
        return;
    }
    try {
        const data = await toDataUrl(src);
        const [w, h] = await naturalSize(data);
        paramState.values['initimage'] = { data, filename: fileName(src), resolution: w && h ? `${w}x${h}` : undefined };
        for (const g of paramState.groupChain(p.group)) {
            if (g.toggles) {
                paramState.groupToggles[g.id] = true;
            }
            paramState.groupOpen[g.id] = true;
        }
        if (p.toggleable) {
            paramState.toggles['initimage'] = true;
        }
        ui.toast('Set as init image.', 'success');
    }
    catch (e) {
        ui.error(e);
    }
}

export async function upscale2x(src: string): Promise<void> {
    try {
        const data = await toDataUrl(src);
        const [w, h] = await naturalSize(data);
        const overrides: Record<string, any> = { initimage: data, images: 1, aspectratio: 'Custom', width: w * 2, height: h * 2 };
        if (!paramState.isEnabled(paramState.byId['initimagecreativity'] ?? ({} as any))) {
            overrides['initimagecreativity'] = 0.4;
        }
        gen.generate(overrides);
    }
    catch (e) {
        ui.error(e);
    }
}

export function viewInHistory(src: string): void {
    const path = historyPath(src);
    if (!path) {
        return;
    }
    ui.historyPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    ui.go('generate', 'history');
}

const HISTORY_FILTER_KEYS: Record<string, string> = { 'Stable-Diffusion': 'Model', LoRA: 'LoRAs', Embedding: 'used_embeddings' };

export const canBrowseModelHistory = (subtype: string) => subtype in HISTORY_FILTER_KEYS;

export function browseModelHistory(subtype: string, modelName: string): void {
    const key = HISTORY_FILTER_KEYS[subtype];
    if (!key) {
        return;
    }
    ui.historyFilter = `${key}: ${cleanModelName(modelName)}`;
    ui.go('generate', 'history');
}

export async function confirmAndDelete(src: string, shift = false): Promise<boolean> {
    const ask = `${userSettings.get('ui.checkifsurebeforedelete', true)}` !== 'false';
    if (!shift && ask && !confirm('Are you sure you want to delete this image?\nHold shift to bypass.')) {
        return false;
    }
    const behavior = `${userSettings.get('ui.deleteimagebehavior', 'next')}`;
    const idx = gen.ordered.findIndex(o => o.src === src);
    const ok = await deleteImage(src);
    if (ok && gen.current === null && behavior !== 'nothing' && idx !== -1 && gen.ordered.length) {
        gen.current = gen.ordered[Math.min(behavior === 'next' ? idx : Math.max(0, idx - 1), gen.ordered.length - 1)];
    }
    return ok;
}

export async function deleteImage(src: string): Promise<boolean> {
    const path = historyPath(src);
    if (!path) {
        return false;
    }
    try {
        await api.deleteImage(path);
        gen.outputs = gen.outputs.filter(o => o.src !== src);
        if (gen.current?.src === src) {
            gen.current = null;
        }
        if (ui.fullView?.src === src) {
            ui.fullView = null;
        }
        ui.toast('Image deleted.', 'success');
        return true;
    }
    catch (e) {
        ui.error(e);
        return false;
    }
}

export async function toggleStar(src: string): Promise<boolean | null> {
    const path = historyPath(src);
    if (!path) {
        return null;
    }
    try {
        const res = await api.toggleImageStarred(path);
        ui.toast(res.new_state ? 'Starred.' : 'Unstarred.', 'success');
        return res.new_state;
    }
    catch (e) {
        ui.error(e);
        return null;
    }
}

export async function refineImage(src: string, metadata: string | null): Promise<void> {
    if (!paramState.groups['refineupscale']) {
        ui.toast('Refine / Upscale group not found (custom workflow?).', 'warning');
        return;
    }
    try {
        const data = await toDataUrl(src);
        const overrides: Record<string, any> = { initimage: data, initimagecreativity: 0, images: 1 };
        const params = parseMetadata(metadata)?.params ?? {};
        if ('seed' in params && !('refinercontrolpercentage' in params)) {
            overrides['seed'] = params['seed'];
        }
        const initOrig = paramState.groupToggles['initimage'];
        const refineOrig = paramState.groupToggles['refineupscale'];
        if ('initimage' in paramState.groupToggles) {
            paramState.groupToggles['initimage'] = false;
        }
        paramState.groupToggles['refineupscale'] = true;
        try {
            gen.generate(overrides);
        }
        finally {
            if (initOrig !== undefined) {
                paramState.groupToggles['initimage'] = initOrig;
            }
            paramState.groupToggles['refineupscale'] = refineOrig;
        }
    }
    catch (e) {
        ui.error(e);
    }
}

export async function useAsImagePrompt(src: string): Promise<void> {
    if (!paramState.byId['promptimages']) {
        ui.toast('Image prompting is not available.', 'warning');
        return;
    }
    try {
        const data = await toDataUrl(src);
        paramState.values['promptimages'] = [...(paramState.values['promptimages'] ?? []), { data, filename: fileName(src) }];
        ui.toast('Added as an image prompt.', 'success');
    }
    catch (e) {
        ui.error(e);
    }
}

export async function openInFolder(src: string): Promise<void> {
    const path = historyPath(src);
    if (path) {
        try {
            await api.openImageFolder(path);
        }
        catch (e) {
            ui.error(e);
        }
    }
}
