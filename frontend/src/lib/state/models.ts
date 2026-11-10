import { api } from '../api/swarm';
import type { ModelInfo } from '../api/types';
import { paramState, cleanModelName } from './params.svelte';
import { ui } from './ui.svelte';
import { resolveUrl } from '../api/client';

export const SWARM_MODEL_PLACEHOLDER = 'imgs/model_placeholder.jpg';

export function hasModelPreview(path: string | null | undefined): path is string {
    return !!path && path.replace(/^\//, '') !== SWARM_MODEL_PLACEHOLDER;
}

export function modelPreviewSrc(path: string | null | undefined): string {
    if (hasModelPreview(path)) return resolveUrl(path);
    return ui.settings.modelPlaceholder === 'swarm' ? resolveUrl(SWARM_MODEL_PLACEHOLDER) : '';
}

export function modelToCurrent(m: ModelInfo): import('./params.svelte').CurrentModel {
    const any = m as any;
    return {
        name: cleanModelName(m.name),
        width: any.standard_width ?? null,
        height: any.standard_height ?? null,
        arch: m.architecture ?? null,
        compat: any.compat_class ?? null,
        special: any.special_format ?? null,
    };
}

let desired: string | null = null;

export async function selectModel(name: string, known?: ModelInfo): Promise<void> {
    if (!name) {
        return;
    }
    if (known) {
        paramState.setModel(modelToCurrent(known));
        return;
    }
    desired = name;
    // set the name immediately so the dropdown doesn't lag; class info follows
    paramState.setModel({ name, width: null, height: null, arch: null, compat: null, special: null, ...(paramState.model?.name === name ? paramState.model : {}) });
    try {
        const res = await api.describeModel(name);
        if (desired !== name) {
            return;
        }
        paramState.setModel(modelToCurrent(res.model));
    }
    catch (e) {
        ui.error(e);
    }
}

export async function ensureCurrentModel(): Promise<void> {
    if (paramState.model?.name) {
        if (paramState.model.width == null) {
            await selectModel(paramState.model.name);
        }
        return;
    }
    try {
        const res = await api.listLoadedModels();
        if (res.models?.length) {
            paramState.setModel(modelToCurrent(res.models[0]));
        }
    }
    catch { }
}
