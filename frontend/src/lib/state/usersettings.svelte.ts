import { api } from '../api/swarm';

function flatten(obj: Record<string, any>, prefix: string, out: Record<string, any>): void {
    for (const [k, v] of Object.entries(obj ?? {})) {
        if (v && typeof v === 'object' && 'value' in v) {
            if (v.type === 'group' && v.value && typeof v.value === 'object') {
                flatten(v.value, `${prefix}${k.toLowerCase()}.`, out);
            }
            else {
                out[`${prefix}${k.toLowerCase()}`] = v.value;
            }
        }
    }
}

class UserSettings {
    values = $state<Record<string, any>>({});
    loaded = $state(false);

    async load(): Promise<void> {
        try {
            const res = await api.getUserSettings();
            const out: Record<string, any> = {};
            flatten(res.settings, '', out);
            this.values = out;
            this.loaded = true;
        }
        catch {
        }
    }

    get<T>(id: string, def: T): T {
        id = id.toLowerCase();
        if (id in this.values) {
            return this.values[id] as T;
        }
        const bare = id.startsWith('ui.') ? id.substring(3) : `ui.${id}`;
        if (bare in this.values) {
            return this.values[bare] as T;
        }
        return def;
    }
}

export const userSettings = new UserSettings();
