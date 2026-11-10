import { cleanModelName, paramState } from './params.svelte';
import { selectModel } from './models';

export interface MetaModelRef {
    id: string;
    param: string;
    name: string;
}

export interface MetaLoraRef {
    name: string;
    weight: number;
    confinement: number;
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',') : []).map(s => s.trim());

export function metadataModels(params: Record<string, any>): MetaModelRef[] {
    const out: MetaModelRef[] = [];
    for (const [id, v] of Object.entries(params)) {
        const p = paramState.byId[id];
        const isModel = id === 'model' || p?.type === 'model';
        if (!isModel || typeof v !== 'string' || !v || ['none', 'automatic', '(none)'].includes(v.toLowerCase())) {
            continue;
        }
        out.push({ id, param: p?.name ?? 'Model', name: cleanModelName(v) });
    }
    return out.sort((a, b) => Number(b.id === 'model') - Number(a.id === 'model'));
}

export function metadataLoras(params: Record<string, any>): MetaLoraRef[] {
    const weights = list(params['loraweights']), conf = list(params['lorasectionconfinement']);
    return list(params['loras']).filter(Boolean).map((name, i) => ({
        name: cleanModelName(name),
        weight: weights[i] ? Number(weights[i]) : 1,
        confinement: conf[i] ? Number(conf[i]) : 0,
    }));
}

export const isModelRefActive = (r: MetaModelRef) => cleanModelName(`${paramState.values[r.id] ?? ''}`) === r.name;

export function useModelRef(r: MetaModelRef): void {
    if (r.id === 'model') {
        selectModel(r.name);
    }
    else {
        paramState.set(r.id, r.name);
    }
}

export const isLoraRefActive = (r: MetaLoraRef) => paramState.loras.some(l => l.name === r.name);

export function toggleLoraRef(r: MetaLoraRef): void {
    if (isLoraRefActive(r)) {
        paramState.toggleLora(r.name);
    }
    else {
        paramState.addLora(r.name, r.weight, r.confinement);
    }
}
