import { api } from '../api/swarm';
import type { Preset, UserData } from '../api/types';
import { paramState } from './params.svelte';

const KEY = 'current_presets';

class PresetState {
    all = $state<Preset[]>([]);
    current = $state<string[]>((localStorage.getItem(KEY) || '').split('|||').filter(Boolean));
    userData = $state<UserData | null>(null);
    loaded = $state(false);

    async load(): Promise<void> {
        const data = await api.getMyUserData();
        this.userData = data;
        this.all = data.presets ?? [];
        this.current = this.current.filter(t => this.all.some(p => p.title === t));
        this.loaded = true;
        this.save();
    }

    get(title: string): Preset | undefined {
        return this.all.find(p => p.title === title);
    }

    isCurrent(title: string): boolean {
        return this.current.includes(title);
    }

    toggle(title: string): void {
        this.current = this.isCurrent(title) ? this.current.filter(t => t !== title) : [...this.current, title];
        this.save();
    }

    clear(): void {
        this.current = [];
        this.save();
    }

    private save(): void {
        localStorage.setItem(KEY, this.current.join('|||'));
    }

    overrides = $derived.by(() => {
        const out: Record<string, { names: string[]; value: any }> = {};
        for (const title of this.current) {
            const p = this.get(title);
            if (!p) {
                continue;
            }
            for (const [key, val] of Object.entries(p.param_map)) {
                const param = paramState.byId[key];
                if (!param) {
                    continue;
                }
                if (param.type !== 'text' || !`${val}`.includes('{value}')) {
                    out[key] ??= { names: [], value: null };
                    out[key].names.push(title);
                    out[key].value = val;
                }
            }
        }
        return out;
    });

    /** applyOnePreset: copy into the panel */
    applyOne(p: Preset): number {
        let n = 0;
        for (const [key, raw] of Object.entries(p.param_map)) {
            const param = paramState.byId[key];
            if (!param) {
                continue;
            }
            let val: any = raw;
            const cur = paramState.values[key];
            if (typeof val === 'string' && val.includes('{value}')) {
                const text = `${cur ?? ''}`;
                const low = text.toLowerCase();
                const end = [low.indexOf('<segment:'), low.indexOf('<object:'), low.indexOf('<region:')].filter(i => i !== -1).sort((a, b) => a - b)[0];
                val = end !== undefined
                    ? val.replace('{value}', text.substring(0, end).trim()) + ' ' + text.substring(end).trim()
                    : val.replace('{value}', text);
            }
            else if (key === 'loras' && cur && (Array.isArray(cur) ? cur.length : `${cur}`)) {
                val = [...(Array.isArray(cur) ? cur : `${cur}`.split(',')), ...(Array.isArray(val) ? val : `${val}`.split(','))];
            }
            else if (key === 'loraweights' && cur && `${cur}`) {
                val = `${Array.isArray(cur) ? cur.join(',') : cur},${Array.isArray(val) ? val.join(',') : val}`;
            }
            paramState.applyMap({ [key]: val });
            n++;
        }
        return n;
    }

    resetParams(): void {
        paramState.resetToDefaults();
        this.clear();
        const def = this.all.find(p => p.title.toLowerCase() === 'default');
        if (def) {
            this.applyOne(def);
        }
    }

    applyAll(): number {
        let n = 0;
        for (const t of this.current) {
            const p = this.get(t);
            if (p) {
                n += this.applyOne(p);
            }
        }
        this.clear();
        return n;
    }
}

export const presetState = new PresetState();
