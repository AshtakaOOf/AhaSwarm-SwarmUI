import type { T2IParam } from '../api/types';
import { LORA_CONFINEMENTS } from '../state/params.svelte';

export interface MetaEntry {
    id: string;
    key: string;
    keyTitle: string;
    value: string;
    nested: MetaEntry[] | null;
    valueTitle: string;
    isPrompt: boolean;
    breakAfter?: boolean;
}

const promptCidMatcher = /<(.*?)\/\/cid=\d+>/g;
const MEDIA = ['image', 'audio', 'video', 'image_list', 'audio_list', 'video_list'];

export function formatMetadataEntries(metadata: string | null, getParam: (id: string) => T2IParam | undefined): { entries: MetaEntry[]; error: string } {
    if (!metadata) {
        return { entries: [], error: '' };
    }
    let data: any;
    try {
        data = JSON.parse(metadata);
    }
    catch {
        return { entries: [], error: `Broken metadata: ${metadata}` };
    }
    // valid JSON that isn't an object (null, a number, a string) would throw below and break the whole render
    if (!data || typeof data !== 'object') {
        return { entries: [], error: `Broken metadata: ${metadata}` };
    }
    data.sui_image_params ??= {};
    const appendObject = (obj: Record<string, any>): MetaEntry[] => {
        const result: MetaEntry[] = [];
        for (let key of Object.keys(obj ?? {})) {
            let val = obj[key];
            if (Array.isArray(val) && val.every(v => v === null || typeof v !== 'object')) {
                val = val.filter(v => v !== null && `${v}` !== '').join(', ');
            }
            if (val === null || val === '') {
                continue;
            }
            const id = key;
            let keyTitle = '', valueTitle = '';
            const isPrompt = key.toLowerCase().replace(/[^a-z0-9]/g, '').endsWith('prompt');
            const param = getParam(key);
            if (param) {
                key = param.name;
                keyTitle = param.description;
                if (param.values && param.value_names && param.values.length === param.value_names.length) {
                    const i = param.values.indexOf(val);
                    if (i !== -1) {
                        valueTitle = `${val}`;
                        val = param.value_names[i];
                    }
                }
                if ((param as any).view_type === 'video_frames') {
                    const frames = parseInt(val);
                    if (Number.isFinite(frames)) {
                        let fps = parseFloat(data.sui_image_params?.videofps ?? getParam('videofps')?.default);
                        if (!Number.isFinite(fps) || fps <= 0) {
                            fps = 24;
                        }
                        const seconds = Math.round(frames / fps * 100) / 100;
                        val = `${seconds} second${seconds === 1 ? '' : 's'} (${frames} frames)`;
                    }
                }
            }
            if (typeof val === 'object') {
                result.push({ id, key, keyTitle, value: '', nested: appendObject(val), valueTitle, isPrompt });
            }
            else {
                result.push({ id, key, keyTitle, value: `${val}`, nested: null, valueTitle, isPrompt });
            }
        }
        return result;
    };
    const entries: MetaEntry[] = [];
    const appendEntries = (list: MetaEntry[], breakAfter = false) => {
        if (!list.length) {
            return;
        }
        if (breakAfter) {
            list[list.length - 1].breakAfter = true;
        }
        entries.push(...list);
    };
    if (data.sui_extra_data) {
        for (const fk of Object.keys(data.sui_extra_data).filter(k => k.endsWith('_filename'))) {
            const pid = fk.slice(0, -'_filename'.length);
            const param = getParam(pid);
            if (!param || !MEDIA.includes(param.type)) {
                continue;
            }
            const arr = (v: any) => (Array.isArray(v) ? v : [v]);
            const fns = arr(data.sui_extra_data[fk]), res = arr(data.sui_extra_data[`${pid}_resolution`]);
            const durs = arr(data.sui_extra_data[`${pid}_duration`]), vals = arr(data.sui_image_params[pid]);
            const isList = param.type.endsWith('_list');
            const combined: string[] = [];
            for (let i = 0; i < (isList ? Math.max(fns.length, vals.length) : 1); i++) {
                let v = fns[i] || vals[i];
                if (!v) {
                    continue;
                }
                if (durs[i]) {
                    const d = parseFloat(durs[i]);
                    v += ` (${Number.isNaN(d) ? durs[i] : Math.round(d * 100) / 100}s)`;
                }
                if (res[i]) {
                    v += ` (${res[i]})`;
                }
                combined.push(v);
            }
            if (combined.length) {
                data.sui_image_params[pid] = isList ? combined : combined[0];
            }
            delete data.sui_extra_data[fk];
            delete data.sui_extra_data[`${pid}_resolution`];
            delete data.sui_extra_data[`${pid}_duration`];
        }
    }
    const p = data.sui_image_params;
    if ('swarm_version' in p && data.sui_extra_data) {
        data.sui_extra_data['Swarm Version'] = p.swarm_version;
        delete p.swarm_version;
    }
    if (p.prompt) {
        let prompt: string | null = p.prompt;
        if (data.sui_extra_data && 'original_prompt' in data.sui_extra_data) {
            const original = data.sui_extra_data.original_prompt;
            delete data.sui_extra_data.original_prompt;
            if (prompt!.replace(promptCidMatcher, '<$1>') === original) {
                prompt = original;
            }
            else {
                appendEntries(appendObject({ 'Processed Prompt': prompt }), true);
                appendEntries(appendObject({ 'Original Prompt': original }), true);
                prompt = null;
            }
        }
        if (prompt != null) {
            appendEntries(appendObject({ prompt }), true);
        }
    }
    delete p.prompt;
    if (p.negativeprompt) {
        const neg = appendObject({ negativeprompt: p.negativeprompt });
        // Display-only rename, only when the raw input is shown too
        if (data.sui_extra_data && 'original_negativeprompt' in data.sui_extra_data) {
            for (const e of neg) {
                e.key = 'Processed Negative Prompt';
            }
        }
        appendEntries(neg, true);
    }
    delete p.negativeprompt;
    if ('loras' in p && 'loraweights' in p) {
        const conf = p.lorasectionconfinement;
        p.loras = (p.loras as string[]).map((l, i) => {
            let w = `${p.loraweights[i]}`;
            if (conf && conf[i] > 0) {
                w = `${w} (${LORA_CONFINEMENTS[conf[i]] ?? conf[i]})`;
            }
            return `${l} : ${w}`;
        });
        delete p.loraweights;
        delete p.lorasectionconfinement;
    }
    if ('width' in p && 'height' in p) {
        let res = `${p.width}x${p.height}`;
        if ('aspectratio' in p && 'sidelength' in p) {
            res += ` (${p.aspectratio} @ ${p.sidelength})`;
        }
        else if ('aspectratio' in p) {
            res += ` (${p.aspectratio})`;
        }
        delete p.width; delete p.height; delete p.aspectratio; delete p.sidelength;
        p.Resolution = res;
    }
    const map: Record<string, any> = {};
    for (const k of ['prompt', 'negativeprompt', 'model', 'images', 'Resolution']) {
        if (k in p) {
            map[k] = p[k];
            delete p[k];
        }
    }
    Object.assign(map, p);
    appendEntries(appendObject(map), true);
    if (data.sui_extra_data) {
        const x = data.sui_extra_data;
        if ('original_negativeprompt' in x) {
            x['Original Negative Prompt'] = x.original_negativeprompt;
            delete x.original_negativeprompt;
        }
        if ('prep_time' in x && 'generation_time' in x) {
            x['Generation Time'] = `${x.prep_time} prep, ${x.generation_time} gen`;
            delete x.prep_time;
            delete x.generation_time;
        }
        appendEntries(appendObject(x));
    }
    return { entries, error: '' };
}
