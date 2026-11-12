import type { ModelInfo } from '../api/types';
import { linkify, stripTags, type KeyValue } from '$ahakit';

export const stripHtml = stripTags;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export function formatModelDate(v: unknown): string {
    if (v == null || v === '') return '';
    const n = Number(v);
    const d = n > 0 ? new Date(n) : new Date(`${v}`);
    if (isNaN(+d)) return `${v}`;
    const day = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    const month = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(d);
    const dayCap = day.replace(month, month.charAt(0).toUpperCase() + month.slice(1));
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
    return `${dayCap} at ${time}`;
}

export function modelFacts(m: ModelInfo, subtype: string, mode: 'card' | 'small' | 'full' = 'full'): KeyValue[] {
    const small = mode === 'small', full = mode === 'full';
    const out: KeyValue[] = [];
    const add = (key: string, v: unknown, mono = false, copy = false) => {
        const s = Array.isArray(v) ? v.join(', ') : stripHtml(v, !full);
        if (s) out.push({ key, value: small ? cut(s, 42) : s, mono, ...(copy ? { copy } : {}) });
    };
    add('File', small ? (m.name.split('/').pop() || m.name) : m.name, true);
    add('Type', small ? (m.architecture || m.class) : (m.class && m.architecture ? `${m.class} (${m.architecture})` : m.class || m.architecture));
    if (m.standard_width) add(small ? 'Res' : 'Resolution', `${m.standard_width}×${m.standard_height}`);
    const triggers = stripHtml(m.trigger_phrase, !full).split(';').map(s => s.trim()).filter(Boolean);
    if (triggers.length) out.push({ key: small ? 'Trigger' : 'Trigger phrase', value: triggers.join('; '), chips: triggers });
    add(small ? 'Hint' : 'Usage hint', m.usage_hint);
    if (subtype === 'LoRA') {
        add(small ? 'Weight' : 'Default weight', m.lora_default_weight);
        add(small ? 'Confine' : 'Default confinement', m.lora_default_confinement);
    }
    if (!full) return out;
    add('Tags', m.tags);
    add('License', m.license);
    add('Merged from', m.merged_from);
    add('Hash', m.hash, true, true);
    add('Date', formatModelDate(m.date));
    if (m.time_created) add('Created', formatModelDate(m.time_created));
    if (m.time_modified) add('Modified', formatModelDate(m.time_modified));
    if (m.local === false) add('Availability', 'Only available on some backends');
    if (m.is_supported_model_format === false) add('Note', "Metadata only available for 'safetensors' models. 'ckpt' pickle files can contain malicious code; use with caution.");
    return out;
}

// description as safe HTML: tags hidden, line breaks kept, bare URLs as links
export const descriptionHtml = (raw: string | undefined | null): string => linkify(raw);
