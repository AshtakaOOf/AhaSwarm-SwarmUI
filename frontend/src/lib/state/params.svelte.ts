import { api, hasPermission } from '../api/swarm';
import type { T2IParam, T2IGroup, ListT2IParamsResponse, ComfyInstallFeature, ParamInstallButton } from '../api/types';
import type { ComfyBuilt } from '../util/comfyParams';
import { load, save } from '../util/storage';
import { userSettings } from './usersettings.svelte';

export const PARAMETER_REMAPS: Record<string, string> = {
    saveintermediateimages: 'outputintermediateimages',
    textvideofps: 'videofps',
    textvideoboomerang: 'videoboomerang',
    textvideoformat: 'videoformat',
};

// classic cleanParamName
export const cleanParamName = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '');

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

class AspectRatio {
    constructor(public id: string, public width: number, public height: number, public altLogic: ((w: number, h: number) => [number, number] | null) | null = null) { }
    read(inWidth: number, inHeight: number, precision: number, doAltLogic = true): [number, number] {
        if (this.altLogic && doAltLogic && precision === 16) {
            const alt = this.altLogic(inWidth, inHeight);
            if (alt) {
                return alt;
            }
        }
        if (inWidth !== inHeight) {
            inWidth = roundTo(Math.sqrt(inWidth * inHeight), precision);
            inHeight = inWidth;
        }
        // NOTE: must match T2IParamInput GetImageWidth (server-side)
        return [roundTo(this.width * (inWidth <= 0 ? 512 : inWidth) / 512, precision), roundTo(this.height * (inHeight <= 0 ? 512 : inHeight) / 512, precision)];
    }
}
const sd768 = (w: number, h: number, out: [number, number]) => (w === 768 && h === 512 ? out : null);
const wan = (w: number, h: number, small: [number, number], big: [number, number]) => (w === 640 && h === 640 ? small : w === 960 && h === 960 ? big : null);
export const ASPECT_RATIOS = [
    new AspectRatio('1:1', 512, 512),
    new AspectRatio('4:3', 576, 448),
    new AspectRatio('3:2', 608, 416, (w, h) => sd768(w, h, [768, 512])),
    new AspectRatio('8:5', 608, 384),
    new AspectRatio('16:9', 672, 384, (w, h) => wan(w, h, [832, 480], [1280, 720])),
    new AspectRatio('21:9', 768, 320),
    new AspectRatio('3:4', 448, 576),
    new AspectRatio('2:3', 416, 608, (w, h) => sd768(w, h, [768, 512])),
    new AspectRatio('5:8', 384, 608),
    new AspectRatio('9:16', 384, 672, (w, h) => wan(w, h, [480, 832], [720, 1280])),
    new AspectRatio('9:21', 320, 768),
];

// classic describeAspectRatio-ish label for Custom sizes
export function describeAspectRatio(w: number, h: number): string {
    const ratio = w / h;
    let best = 'Custom', diff = 0.02;
    for (const ar of ASPECT_RATIOS) {
        const d = Math.abs(ar.width / ar.height - ratio);
        if (d < diff) {
            best = ar.id;
            diff = d;
        }
    }
    return best;
}

export interface CurrentModel {
    name: string;
    width: number | null;
    height: number | null;
    arch: string | null;
    compat: string | null;
    special: string | null;
}

function modelFeatureFlags(m: CurrentModel | null): { add: string[]; remove: string[] } {
    const add: string[] = [], remove: string[] = [];
    const compat = m?.compat ?? '', arch = m?.arch ?? '';
    const anyCompat = (ids: string[], flag: string) => (compat && ids.some(id => compat.startsWith(id)) ? add : remove).push(flag);
    const anyArch = (ids: string[], flag: string) => (arch && ids.some(id => arch.startsWith(id)) ? add : remove).push(flag);
    anyCompat(['stable-diffusion-v3'], 'sd3');
    anyCompat(['stable-cascade-v1'], 'cascade');
    anyArch(['Flux.1-dev', 'flux.2-dev', 'flux.2-klein-4b', 'flux.2-klein-9b', 'hunyuan-video'], 'flux-dev');
    anyCompat(['krea-2'], 'optional_reference_latent');
    anyCompat(['stable-diffusion-xl-v1'], 'sdxl');
    anyCompat(['stable-diffusion-v1', 'stable-diffusion-xl-v1'], 'model_has_ipadapter');
    anyCompat(['stable-diffusion-v1', 'stable-diffusion-v2', 'stable-diffusion-xl-v1'], 'supports_reference_only');
    anyCompat(['stable-diffusion-v1', 'stable-diffusion-v2', 'stable-diffusion-xl-v1'], 'supports_hypertile');
    anyCompat(['genmo-mochi-1', 'lightricks-ltx-video', 'hunyuan-video', 'nvidia-cosmos-1', 'wan-21', 'wan-22', 'kandinsky5-vidlite', 'kandinsky5-vidpro', 'minimax-h3'], 'text2video');
    anyCompat(['ace-step-1_5', 'minimax-music-3', 'yue-2'], 'text2audio');
    anyCompat(['ace-step-1_5'], 'audio_ace_inputs');
    return { add, remove };
}

export const SPECIAL_PARAMS = new Set(['prompt', 'negativeprompt', 'model', 'loras', 'loraweights', 'lorasectionconfinement', 'promptimages', 'promptaudios', 'promptvideos']);

const BUILTIN_INSTALL_BUTTONS: ParamInstallButton[] = [
    { group_id: 'controlnet', feature_id: 'controlnetpreprocessors', install_id: 'controlnet_preprocessors', label: 'Install Controlnet Preprocessors', keep_visible: true },
    { group_id: 'imageprompting', feature_id: 'ipadapter', install_id: 'ipadapter', label: 'Install IP Adapter', keep_visible: false },
    { group_id: 'advancedvideo', feature_id: 'frameinterps', install_id: 'frame_interpolation', label: 'Install Frame Interpolation', keep_visible: true },
];

export interface GroupNode {
    group: T2IGroup | null;
    params: T2IParam[];
    children: GroupNode[];
}

interface Persisted {
    values: Record<string, any>;
    toggles: Record<string, boolean>;
    groupToggles: Record<string, boolean>;
    groupOpen: Record<string, boolean>;
    // ms timestamp of the last save; classic expires `lastparam_` cookies after parametermemorydurationhours
    savedAt?: number;
}

export function defaultFor(p: T2IParam): any {
    switch (p.type) {
        case 'integer':
        case 'decimal': {
            const n = Number(p.default);
            return Number.isFinite(n) ? n : 0;
        }
        case 'boolean':
            return `${p.default}`.toLowerCase() === 'true';
        case 'list':
            return p.default ? `${p.default}`.split(',').map(s => s.trim()).filter(Boolean) : [];
        case 'image':
        case 'audio':
        case 'video':
        case 'image_list':
        case 'audio_list':
        case 'video_list':
            return null;
        default:
            return p.default ?? '';
    }
}

export function coerce(p: T2IParam, v: any): any {
    switch (p.type) {
        case 'integer':
        case 'decimal': {
            const n = Number(v);
            return Number.isFinite(n) ? n : defaultFor(p);
        }
        case 'boolean':
            return `${v}`.toLowerCase() === 'true';
        case 'list':
            if (Array.isArray(v)) {
                return v.map(String);
            }
            if (typeof v === 'string' && v.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(v);
                    if (Array.isArray(parsed)) {
                        return parsed.map(String);
                    }
                }
                catch { }
            }
            return v == null || v === '' ? [] : `${v}`.split(',').map(s => s.trim()).filter(Boolean);
        default:
            return v;
    }
}

function comfyParam(raw: any, group: string | null): T2IParam {
    return {
        name: raw.name ?? raw.id,
        id: raw.id,
        description: raw.description ?? '',
        type: raw.type ?? 'text',
        subtype: raw.subtype ?? null,
        default: raw.default ?? '',
        min: Number(raw.min ?? 0),
        max: Number(raw.max ?? 0),
        view_max: Number(raw.view_max ?? raw.max ?? 0),
        step: Number(raw.step ?? 0),
        values: Array.isArray(raw.values) ? raw.values.map(String) : null,
        examples: null,
        visible: raw.visible !== false,
        advanced: !!raw.advanced,
        feature_flag: raw.feature_flag ?? null,
        toggleable: !!raw.toggleable,
        priority: Number(raw.priority ?? 0),
        group,
        always_retain: !!raw.always_retain,
        do_not_save: !!raw.do_not_save,
        do_not_preview: !!raw.do_not_preview,
        view_type: raw.view_type ?? 'normal',
        extra_hidden: !!raw.extra_hidden,
    };
}

class ParamState {
    loaded = $state(false);
    // true when remembered values were restored at load (classic applies the "Default" preset otherwise)
    restored = false;
    // raw: replaced as a whole on load / edits, never mutated
    params = $state.raw<T2IParam[]>([]);
    groups = $state<Record<string, T2IGroup>>({});
    models = $state.raw<Record<string, [string, string][]>>({});
    wildcards = $state<string[]>([]);
    serverFeatures = $state<string[]>([]);
    installFeatures = $state<Record<string, ComfyInstallFeature>>({});
    extensionInstallButtons = $state<ParamInstallButton[]>([]);
    installStatus = $state<Record<string, 'installing' | 'installed' | 'error'>>({});
    installError = $state<Record<string, string>>({});
    installDismissed = $state<Record<string, boolean>>({});
    compatClasses = $state<Record<string, any>>({});
    modelClasses = $state<Record<string, any>>({});
    model = $state<CurrentModel | null>(load<CurrentModel | null>('selected_model', null));
    features = $derived.by(() => {
        const { add, remove } = modelFeatureFlags(this.model);
        return [...new Set([...this.serverFeatures.filter(f => !remove.includes(f)), ...add])];
    });

    values = $state<Record<string, any>>({});
    toggles = $state<Record<string, boolean>>({});
    groupToggles = $state<Record<string, boolean>>({});
    groupOpen = $state<Record<string, boolean>>({});
    filter = $state('');
    // classic doParamHides
    managedParams = $state<string[]>([]);
    // classic getGenInput hooks, run before overrides
    readonly inputHooks: ((input: Record<string, any>, extra: Record<string, string>) => void)[] = [];

    byId = $derived(Object.fromEntries(this.params.map(p => [p.id, p])) as Record<string, T2IParam>);

    async load(): Promise<void> {
        const data: ListT2IParamsResponse = await api.listT2IParams();
        this.ingest(data);
    }

    async loadInstallFeatures(): Promise<void> {
        if (!hasPermission('install_features')) {
            return;
        }
        const data = await api.ahaGetInstallFeatures();
        this.installFeatures = data.features ?? {};
        this.extensionInstallButtons = data.buttons ?? [];
    }

    private allInstallButtons(): ParamInstallButton[] {
        const out: ParamInstallButton[] = [];
        const seen = new Set<string>();
        for (const b of [...BUILTIN_INSTALL_BUTTONS, ...this.extensionInstallButtons]) {
            const key = `${b.group_id}\0${b.feature_id}\0${b.install_id}`;
            if (!seen.has(key)) {
                seen.add(key);
                out.push(b);
            }
        }
        return out;
    }

    private hasInstallButtonTarget(b: ParamInstallButton): boolean {
        // classic currentBackendFeatureSet.includes(featureId)
        const hasFeature = this.features.includes(b.feature_id);
        const hasInstall = b.install_id.split(',').every(id => !!this.installFeatures[id.trim()]);
        return !hasFeature && hasInstall;
    }

    private showsInstallButton(b: ParamInstallButton): boolean {
        return !this.installDismissed[b.install_id] && this.hasInstallButtonTarget(b);
    }

    installButtonsFor(groupId: string): ParamInstallButton[] {
        if (this.comfyOn || !hasPermission('install_features')) {
            return [];
        }
        return this.allInstallButtons().filter(b => b.group_id === groupId && this.showsInstallButton(b));
    }

    dismissInstall(installId: string): void {
        this.installDismissed[installId] = true;
        delete this.installStatus[installId];
        delete this.installError[installId];
    }

    syncServerFeatures(features: string[]): void {
        this.serverFeatures = features;
        for (const b of this.allInstallButtons()) {
            if (this.features.includes(b.feature_id) && this.installStatus[b.install_id] === 'installed') {
                delete this.installStatus[b.install_id];
                delete this.installError[b.install_id];
            }
        }
    }

    private raw: ListT2IParamsResponse | null = null;
    paramEdits = $state<{ groups: Record<string, any>; params: Record<string, any> }>({ groups: {}, params: {} });

    private structure(): { groups: Record<string, T2IGroup>; list: T2IParam[] } {
        const data = this.raw!;
        const groups: Record<string, T2IGroup> = {};
        for (const g of data.groups ?? []) {
            groups[g.id] = { ...g, ...(this.paramEdits.groups[g.id] ?? {}) };
        }
        const list = data.list.map(p => {
            const out: any = { ...p };
            for (const [k, v] of Object.entries(this.paramEdits.params[p.id] ?? {})) {
                if (k === 'examples') {
                    out.examples = `${v}`.split('||').map(x => x.trim()).filter(Boolean);
                }
                else if (k === 'group') {
                    out.original_group = p.group;
                    out.group = groups[v as string] ? v : p.group;
                }
                else {
                    out[k] = v;
                }
            }
            return out as T2IParam;
        }).sort((a, b) => a.priority - b.priority);
        return { groups, list };
    }

    isStarred(id: string): boolean {
        return this.byId[id]?.group === 'starred';
    }

    async toggleStarParam(id: string): Promise<void> {
        const edits = $state.snapshot(this.paramEdits);
        const e = edits.params[id] ?? {};
        if (this.isStarred(id)) {
            delete e.group;
            delete e.advanced;
        }
        else {
            e.group = 'starred';
            e.advanced = false;
        }
        edits.params[id] = e;
        this.paramEdits = edits;
        if (this.comfyOn) {
            await api.setParamEdits(edits);
            return;
        }
        const { groups, list } = this.structure();
        this.groups = groups;
        this.params = list;
        if (groups['starred'] && !('starred' in this.groupOpen)) {
            this.groupOpen['starred'] = true;
        }
        await api.setParamEdits(edits);
    }

    ingest(data: ListT2IParamsResponse): void {
        let persisted = load<Persisted>('params', { values: {}, toggles: {}, groupToggles: {}, groupOpen: {} });
        const hours = Number(userSettings.get('parametermemorydurationhours', 6));
        if (persisted.savedAt && Number.isFinite(hours) && Date.now() - persisted.savedAt > hours * 3600_000) {
            persisted = { values: {}, toggles: {}, groupToggles: {}, groupOpen: persisted.groupOpen ?? {} };
        }
        this.restored = Object.keys(persisted.values ?? {}).length > 0;
        this.raw = data;
        this.paramEdits = { groups: {}, params: {}, ...(data.param_edits ?? {}) };
        this.models = data.models ?? {};
        this.wildcards = data.wildcards ?? [];
        this.compatClasses = data.model_compat_classes ?? {};
        this.modelClasses = data.model_classes ?? {};
        if (this.comfyOn) {
            this.loaded = true;
            return;
        }
        const { groups, list } = this.structure();
        const values: Record<string, any> = {};
        const toggles: Record<string, boolean> = {};
        for (const p of list) {
            const keep = p.id in persisted.values && !p.do_not_save && !p.nonreusable;
            values[p.id] = keep ? coerce(p, persisted.values[p.id]) : defaultFor(p);
            if (p.toggleable) {
                toggles[p.id] = !!persisted.toggles[p.id];
            }
        }
        const groupToggles: Record<string, boolean> = {};
        const groupOpen: Record<string, boolean> = {};
        for (const g of Object.values(groups)) {
            if (g.toggles) {
                groupToggles[g.id] = !!persisted.groupToggles[g.id];
            }
            groupOpen[g.id] = g.id in persisted.groupOpen ? persisted.groupOpen[g.id] : g.open;
        }
        this.groups = groups;
        this.params = list;
        this.values = values;
        this.toggles = toggles;
        this.groupToggles = groupToggles;
        this.groupOpen = groupOpen;
        if (this.byId['batchsize'] && `${userSettings.get('resetbatchsizetoone', false)}` === 'true') {
            this.values['batchsize'] = 1;
        }
        if (this.model && this.byId['model']) {
            this.values['model'] = this.model.name;
        }
        this.loaded = true;
        this.restoreComfy();
    }

    comfyOn = $state(false);
    private comfyBackup: { params: T2IParam[]; groups: Record<string, T2IGroup>; values: Record<string, any>; toggles: Record<string, boolean> } | null = null;

    baseParamIds(): string[] {
        return (this.raw?.list ?? this.params).map(p => p.id);
    }

    applyComfy(built: Pick<ComfyBuilt, 'params' | 'retained' | 'paramVal'>): void {
        if (!this.comfyOn) {
            this.comfyBackup = {
                params: this.params,
                groups: { ...this.groups },
                values: $state.snapshot(this.values),
                toggles: $state.snapshot(this.toggles),
            };
        }
        const base = this.comfyBackup!;
        const keep = new Set(built.retained);
        const groups: Record<string, T2IGroup> = {};
        const kept = base.params.filter(p => keep.has(p.id) || p.always_retain);
        for (const p of kept) {
            let g = p.group ? base.groups[p.group] : undefined;
            while (g) {
                groups[g.id] = g;
                g = g.parent ? base.groups[g.parent] : undefined;
            }
        }
        const list: T2IParam[] = kept.map(p => ({ ...p }));
        const seen = new Set(list.map(p => p.id));
        for (const raw of Object.values(built.params)) {
            if (!raw?.id || seen.has(raw.id)) {
                continue;
            }
            let gid: string | null = null;
            const g = raw.group;
            if (g && typeof g === 'object' && g.id) {
                gid = `${g.id}`;
                groups[gid] = {
                    name: g.name ?? gid, id: gid, toggles: !!g.toggles, open: g.open !== false,
                    priority: Number(g.priority ?? 0), description: g.description ?? '',
                    advanced: !!g.advanced, can_shrink: g.can_shrink !== false, parent: null,
                };
                if (!(gid in this.groupOpen)) {
                    this.groupOpen[gid] = g.open !== false;
                }
            }
            list.push(comfyParam(raw, gid));
            seen.add(raw.id);
        }
        list.sort((a, b) => a.priority - b.priority);
        this.groups = groups;
        this.params = list;
        const first = !this.comfyOn;
        for (const p of list) {
            let val = built.paramVal[p.id];
            if (val === undefined) {
                val = p.default;
            }
            if (p.type === 'integer' && p.view_type === 'seed' && typeof val === 'number' && val > 2 ** 63) {
                val = -1;
            }
            if (p.id === 'model' && typeof val === 'string') {
                val = val.split('\\').join('/');
            }
            if (first || !(p.id in this.values) || p.id in built.paramVal || p.extra_hidden) {
                this.values[p.id] = coerce(p, val);
            }
            if (p.toggleable && p.id in built.paramVal) {
                this.toggles[p.id] = true;
            }
        }
        this.comfyOn = true;
        try {
            localStorage.setItem('last_comfy_workflow_input', JSON.stringify({ params: built.params, retained: built.retained, paramVal: built.paramVal }));
        }
        catch { }
    }

    // classic comfyParamsDisable
    clearComfy(): void {
        localStorage.removeItem('last_comfy_workflow_input');
        const saved = this.comfyBackup;
        this.comfyBackup = null;
        this.comfyOn = false;
        if (!saved) {
            return;
        }
        this.params = saved.params;
        this.groups = saved.groups;
        this.values = saved.values;
        this.toggles = saved.toggles;
    }

    private restoreComfy(): void {
        if (this.comfyOn) {
            return;
        }
        try {
            const raw = localStorage.getItem('last_comfy_workflow_input');
            if (!raw) {
                return;
            }
            const saved = JSON.parse(raw);
            if (saved?.params && Array.isArray(saved.retained)) {
                this.applyComfy(saved);
            }
        }
        catch { }
    }

    // classic getResolutionPrecision
    resolutionPrecision(): number {
        const compat = this.model?.compat ? this.compatClasses[this.model.compat] : null;
        return compat?.resolution_precision || 16;
    }

    setModel(m: CurrentModel): void {
        this.model = m;
        save('selected_model', m);
        if (this.byId['model']) {
            this.values['model'] = m.name;
        }
        this.applyAspectRatio();
    }

    persist(): void {
        if (!this.loaded) {
            return;
        }
        const values: Record<string, any> = {};
        for (const p of this.params) {
            if (p.do_not_save || ['image', 'image_list', 'audio', 'audio_list', 'video', 'video_list'].includes(p.type)) {
                continue;
            }
            values[p.id] = $state.snapshot(this.values[p.id]);
        }
        save('params', {
            values,
            toggles: $state.snapshot(this.toggles),
            groupToggles: $state.snapshot(this.groupToggles),
            groupOpen: $state.snapshot(this.groupOpen),
            savedAt: Date.now(),
        } satisfies Persisted);
    }

    isSupported(p: T2IParam): boolean {
        return !p.feature_flag || p.feature_flag.split(',').every(f => this.features.includes(f.trim()));
    }

    groupChain(id: string | null): T2IGroup[] {
        const chain: T2IGroup[] = [];
        let g = id ? this.groups[id] : undefined;
        let guard = 0;
        while (g && guard++ < 20) {
            chain.push(g);
            g = g.parent ? this.groups[g.parent] : undefined;
        }
        return chain;
    }

    isEnabled(p: T2IParam): boolean {
        if (p.toggleable && !this.toggles[p.id]) {
            return false;
        }
        if (!this.isSupported(p)) {
            return false;
        }
        for (const g of this.groupChain(p.group)) {
            if (g.toggles && !this.groupToggles[g.id]) {
                return false;
            }
        }
        return true;
    }

    // Width/height show only for Custom AR, Side Length only otherwise (classic resTrick `visible_controlled`)
    isVisibleControlledHidden(p: T2IParam): boolean {
        if (!this.byId['aspectratio'] || !this.byId['width'] || !this.byId['height'] || !this.byId['sidelength']) {
            return false;
        }
        const custom = `${this.values['aspectratio']}` === 'Custom';
        return custom ? p.id === 'sidelength' : p.id === 'width' || p.id === 'height';
    }

    // classic hideUnsupportableParams isAltered
    isAltered(p: T2IParam): boolean {
        let altered = p.toggleable ? !!this.toggles[p.id] : `${this.values[p.id]}` !== `${defaultFor(p)}`;
        const g = p.group ? this.groups[p.group] : null;
        if (g && g.toggles && !this.groupToggles[g.id]) {
            altered = false;
        }
        if (this.isVisibleControlledHidden(p)) {
            altered = false;
        }
        return altered;
    }

    dependencyHidden(p: T2IParam): boolean {
        if (!p.depend_non_default) {
            return false;
        }
        const other = this.byId[p.depend_non_default];
        if (!other) {
            return false;
        }
        if (other.toggleable) {
            return !this.toggles[other.id];
        }
        const v = this.values[other.id];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            return false;
        }
        return `${v ?? ''}` === `${defaultFor(other) ?? ''}` || (other.type === 'list' && Array.isArray(v) && !v.length);
    }

    isShown(p: T2IParam, showAdvanced: boolean): boolean {
        if (SPECIAL_PARAMS.has(p.id) || !p.visible || p.extra_hidden || !this.isSupported(p) || this.isVisibleControlledHidden(p) || this.managedParams.includes(p.id)) {
            return false;
        }
        if (this.groupChain(p.group).some(g => g.id === 'imageprompting') && !this.hasPromptMedia) {
            return false;
        }
        let f = this.filter.trim().toLowerCase();
        const hideUnaltered = f.includes('<unaltered>');
        f = f.split('<unaltered>').join('').trim();
        const altered = this.isAltered(p);
        if (hideUnaltered && !altered) {
            return false;
        }
        if (!showAdvanced && !altered && (p.advanced || (p.group && this.groups[p.group]?.advanced))) {
            return false;
        }
        if (this.dependencyHidden(p)) {
            return false;
        }
        if (f) {
            const g = p.group ? this.groups[p.group]?.name ?? '' : '';
            return `${p.id} ${p.name} ${p.description} ${g}`.toLowerCase().includes(f);
        }
        return true;
    }

    get hasPromptMedia(): boolean {
        return ['promptimages', 'promptaudios', 'promptvideos'].some(k => Array.isArray(this.values[k]) && this.values[k].length > 0);
    }

    advancedCount = $derived.by(() => {
        const f = this.filter.trim().toLowerCase().split('<unaltered>').join('');
        return this.params.filter(p => p.advanced && p.visible && !SPECIAL_PARAMS.has(p.id) && this.isSupported(p)
            && (!f || `${p.id} ${p.name} ${p.description}`.toLowerCase().includes(f))).length;
    });

    groupStats(showAdvanced: boolean): Record<string, { visible: number; altered: number }> {
        const out: Record<string, { visible: number; altered: number }> = {};
        for (const p of this.params) {
            if (!this.isShown(p, showAdvanced)) {
                continue;
            }
            const altered = this.isAltered(p);
            for (const g of this.groupChain(p.group)) {
                out[g.id] ??= { visible: 0, altered: 0 };
                out[g.id].visible++;
                if (altered) {
                    out[g.id].altered++;
                }
            }
        }
        return out;
    }

    tree(showAdvanced: boolean): GroupNode {
        const root: GroupNode = { group: null, params: [], children: [] };
        const nodes: Record<string, GroupNode> = {};
        const nodeFor = (gid: string | null): GroupNode => {
            if (!gid || !this.groups[gid]) {
                return root;
            }
            if (nodes[gid]) {
                return nodes[gid];
            }
            const g = this.groups[gid];
            const node: GroupNode = { group: g, params: [], children: [] };
            nodes[gid] = node;
            const parent = nodeFor(g.parent);
            parent.children.push(node);
            return node;
        };
        for (const p of this.params) {
            if (this.isShown(p, showAdvanced)) {
                nodeFor(p.group).params.push(p);
            }
        }
        if (!this.comfyOn && !this.filter.trim() && hasPermission('install_features')) {
            for (const b of this.allInstallButtons()) {
                if (b.keep_visible === false || !this.showsInstallButton(b)) {
                    continue;
                }
                const g = this.groups[b.group_id];
                if (g && (!g.advanced || showAdvanced)) {
                    nodeFor(b.group_id);
                }
            }
        }
        const sortRec = (n: GroupNode) => {
            n.children.sort((a, b) => (a.group!.priority - b.group!.priority));
            n.children.forEach(sortRec);
        };
        sortRec(root);
        return root;
    }

    set(id: string, value: any, enable = true): void {
        const p = this.byId[id];
        if (!p) {
            return;
        }
        this.values[id] = coerce(p, value);
        if (enable && p.toggleable) {
            this.toggles[id] = true;
        }
        if (enable) {
            for (const g of this.groupChain(p.group)) {
                if (g.toggles) {
                    this.groupToggles[g.id] = true;
                }
            }
        }
        if (id === 'aspectratio' || id === 'sidelength') {
            this.applyAspectRatio();
        }
    }

    // classic swap_aspectratio_button
    swapResolution(): void {
        [this.values['width'], this.values['height']] = [this.values['height'], this.values['width']];
    }

    applyAspectRatio(): void {
        const ar = `${this.values['aspectratio'] ?? 'Custom'}`;
        if (!this.byId['width'] || !this.byId['height'] || ar === 'Custom') {
            return;
        }
        const ratio = ASPECT_RATIOS.find(r => r.id === ar);
        if (!ratio) {
            return;
        }
        let tw = this.model?.width ?? 0, th = this.model?.height ?? 0, alt = true;
        const side = Number(this.values['sidelength']);
        if (this.byId['sidelength'] && side && (!this.byId['sidelength'].toggleable || this.toggles['sidelength'])) {
            tw = th = side;
            alt = false;
        }
        const [w, h] = ratio.read(tw, th, this.resolutionPrecision(), alt);
        this.values['width'] = w;
        this.values['height'] = h;
    }

    // classic resolution group label: "Resolution: AR (WxH)"
    get resolutionLabel(): string {
        const ar = `${this.values['aspectratio'] ?? 'Custom'}`;
        const w = this.values['width'], h = this.values['height'];
        return `${ar === 'Custom' ? describeAspectRatio(Number(w), Number(h)) : ar} (${w}x${h})`;
    }

    applyMap(map: Record<string, any>, opts: { skipSeed?: boolean } = {}): string[] {
        const applied: string[] = [];
        for (const [key, val] of Object.entries(map)) {
            const p = this.byId[key];
            if (!p || p.nonreusable || (opts.skipSeed && key === 'seed')) {
                continue;
            }
            if (['image', 'audio', 'video', 'image_list', 'audio_list', 'video_list'].includes(p.type)) {
                continue;
            }
            this.values[key] = coerce(p, val);
            if (p.toggleable) {
                this.toggles[key] = true;
            }
            for (const g of this.groupChain(p.group)) {
                if (g.toggles) {
                    this.groupToggles[g.id] = true;
                }
            }
            applied.push(key);
        }
        return applied;
    }

    resetToDefaults(exclude: string[] = []): void {
        for (const p of this.params) {
            if (p.id === 'model' || exclude.includes(p.id)) {
                continue;
            }
            this.values[p.id] = defaultFor(p);
            if (p.toggleable) {
                this.toggles[p.id] = false;
            }
        }
        for (const g of Object.values(this.groups)) {
            if (g.toggles) {
                this.groupToggles[g.id] = false;
            }
        }
        this.applyAspectRatio();
    }

    reuseMetadata(raw: string | Record<string, any>): string[] {
        const full = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const metadata: Record<string, any> = { ...(full.sui_image_params ?? {}) };
        const extra: Record<string, any> = full.sui_extra_data || metadata;
        for (const k of Object.keys(metadata)) {
            const remap = PARAMETER_REMAPS[k];
            if (remap) {
                metadata[remap] = metadata[k];
                delete metadata[k];
            }
        }
        if ('original_prompt' in extra) {
            metadata.prompt = extra.original_prompt;
        }
        if ('original_negativeprompt' in extra) {
            metadata.negativeprompt = extra.original_negativeprompt;
        }
        if (Array.isArray(metadata.lorasectionconfinement) && Array.isArray(metadata.loras) && Array.isArray(metadata.loraweights)) {
            const { lorasectionconfinement: conf, loras, loraweights: weights } = metadata;
            const prompted: string[] = extra.prompted_loras || [];
            const old = !metadata.swarm_version || /^0\.9\.[0-6]\./.test(metadata.swarm_version);
            if (conf.length === loras.length && loras.length === weights.length) {
                const keep = loras.map((l: string, i: number) => (old ? conf[i] == -1 : !prompted.includes(l)));
                metadata.loras = loras.filter((_: any, i: number) => keep[i]);
                metadata.loraweights = weights.filter((_: any, i: number) => keep[i]);
                if (old) {
                    delete metadata.lorasectionconfinement;
                }
                else {
                    metadata.lorasectionconfinement = conf.filter((_: any, i: number) => keep[i]);
                }
            }
        }
        if (Array.isArray(metadata.loraweights)) {
            metadata.loraweights = metadata.loraweights.join(',');
        }
        if (!('aspectratio' in metadata) && 'width' in metadata && 'height' in metadata) {
            metadata.aspectratio = 'Custom';
        }
        const exclude = `${userSettings.get('reuseparamexcludelist', '')}`.split(',').map(cleanParamName).filter(Boolean);
        const resetExclude = [...exclude, ...Object.keys(metadata), ...Object.keys(extra).filter(e => e.endsWith('_filename')).map(e => e.slice(0, -'_filename'.length))];
        this.resetToDefaults(resetExclude);
        const applied: string[] = [];
        for (const p of this.params) {
            if (p.nonreusable || exclude.includes(p.id)) {
                continue;
            }
            const val = metadata[p.id];
            if (val !== undefined && val !== null && val !== '') {
                if (['image', 'audio', 'video', 'image_list', 'audio_list', 'video_list'].includes(p.type)) {
                    continue;
                }
                for (const g of this.groupChain(p.group)) {
                    if (g.toggles) {
                        this.groupToggles[g.id] = true;
                    }
                    this.groupOpen[g.id] = true;
                }
                this.values[p.id] = coerce(p, val);
                if (p.toggleable) {
                    this.toggles[p.id] = true;
                }
                applied.push(p.id);
            }
            else if (p.toggleable && p.visible && !resetExclude.includes(p.id)) {
                this.toggles[p.id] = false;
            }
        }
        return applied;
    }

    buildInput(overrides: Record<string, any> = {}): Record<string, any> {
        const input: Record<string, any> = {};
        const extra: Record<string, string> = {};
        for (const p of this.params) {
            if (!this.isEnabled(p)) {
                continue;
            }
            let v = $state.snapshot(this.values[p.id]);
            if (v == null) {
                continue;
            }
            if (p.type === 'image' || p.type === 'video' || p.type === 'audio') {
                if (typeof v === 'object') {
                    if (v.filename) {
                        extra[`${p.id}_filename`] = v.filename;
                    }
                    if (v.resolution) {
                        extra[`${p.id}_resolution`] = v.resolution;
                    }
                    v = v.data;
                }
                if (!v) {
                    continue;
                }
            }
            if (p.type === 'image_list' || p.type === 'audio_list' || p.type === 'video_list') {
                if (!Array.isArray(v) || v.length === 0) {
                    continue;
                }
                v = v.map((x: any) => (typeof x === 'object' ? x.data : x));
            }
            if (p.type === 'list' && Array.isArray(v) && v.length === 0) {
                continue;
            }
            input[p.id] = v;
        }
        for (const p of this.params) {
            if (p.depend_non_default && p.id in input) {
                const other = this.byId[p.depend_non_default];
                if (other && !(other.id in overrides) && (!(other.id in input) || `${input[other.id]}` === `${other.default}`)) {
                    delete input[p.id];
                }
            }
        }
        if (input['aspectratio'] === 'Custom') {
            delete input['sidelength'];
        }
        if ('vae' in this.byId && (!input['vae'] || input['vae'] === 'Automatic')) {
            input['automaticvae'] = true;
            delete input['vae'];
        }
        for (const hook of this.inputHooks) {
            hook(input, extra);
        }
        for (const [k, v] of Object.entries(overrides)) {
            if (v == null) {
                delete input[k];
            }
            else {
                input[k] = v;
            }
        }
        input['extra_metadata'] = extra;
        return input;
    }

    private loraPref: Record<string, { weight?: number; confinement?: number }> = load('lora_prefs', {});

    get loras(): { name: string; weight: number; confinement: number }[] {
        const names: string[] = coerce(this.byId['loras'] ?? ({ type: 'list' } as T2IParam), this.values['loras']);
        const split = (v: any) => (Array.isArray(v) ? v.map(String) : `${v ?? ''}`.split(',')).map(s => s.trim());
        const weights = split(this.values['loraweights']);
        const conf = this.toggles['lorasectionconfinement'] !== false ? split(this.values['lorasectionconfinement']) : [];
        return names.map((name, i) => ({
            name,
            weight: weights[i] !== undefined && weights[i] !== '' ? Number(weights[i]) : 1,
            confinement: conf[i] !== undefined && conf[i] !== '' ? Number(conf[i]) : 0,
        }));
    }

    // classic rebuildParams
    setLoras(list: { name: string; weight: number; confinement?: number }[]): void {
        this.values['loras'] = list.map(l => l.name);
        this.values['loraweights'] = list.map(l => `${l.weight}`).join(',');
        const anyConfined = list.some(l => (l.confinement ?? 0) !== 0);
        if (this.byId['lorasectionconfinement']) {
            this.values['lorasectionconfinement'] = anyConfined ? list.map(l => `${l.confinement ?? 0}`).join(',') : '';
            if (this.byId['lorasectionconfinement'].toggleable) {
                this.toggles['lorasectionconfinement'] = anyConfined;
            }
        }
        const on = list.length > 0;
        if (this.byId['loras']?.toggleable) {
            this.toggles['loras'] = on;
        }
        if (this.byId['loraweights']?.toggleable) {
            this.toggles['loraweights'] = on;
        }
    }

    setLoraWeight(name: string, weight: number): void {
        this.loraPref[name] = { ...this.loraPref[name], weight };
        save('lora_prefs', this.loraPref);
        this.setLoras(this.loras.map(l => (l.name === name ? { ...l, weight } : l)));
    }

    setLoraConfinement(name: string, confinement: number): void {
        this.loraPref[name] = { ...this.loraPref[name], confinement };
        save('lora_prefs', this.loraPref);
        this.setLoras(this.loras.map(l => (l.name === name ? { ...l, confinement } : l)));
    }

    addLora(rawName: string, weight: number, confinement = 0): void {
        const name = cleanModelName(rawName);
        const entry = { name, weight: Number.isFinite(weight) ? weight : 1, confinement: Number.isFinite(confinement) ? confinement : 0 };
        const cur = this.loras;
        const i = cur.findIndex(l => l.name === name);
        if (i >= 0) {
            cur[i] = entry;
        }
        else {
            cur.push(entry);
        }
        this.setLoras(cur);
    }

    toggleLora(rawName: string, model?: { lora_default_weight?: string; lora_default_confinement?: string }): void {
        const name = cleanModelName(rawName);
        const cur = this.loras;
        const i = cur.findIndex(l => l.name === name);
        if (i >= 0) {
            cur.splice(i, 1);
        }
        else {
            const pref = this.loraPref[name] ?? {};
            const weight = model?.lora_default_weight ? parseFloat(model.lora_default_weight) : pref.weight ?? 1;
            const confinement = model?.lora_default_confinement ? parseInt(model.lora_default_confinement) : pref.confinement ?? 0;
            cur.push({ name, weight: Number.isFinite(weight) ? weight : 1, confinement: Number.isFinite(confinement) ? confinement : 0 });
        }
        this.setLoras(cur);
    }
}

// classic cleanModelName
export const cleanModelName = (name: string) => (name.endsWith('.safetensors') ? name.slice(0, -'.safetensors'.length) : name);
export const LORA_CONFINEMENTS: Record<number, string> = { 0: 'Global', 5: 'Base', 1: 'Refiner', 2: 'Video', 3: 'VideoSwap' };

export const paramState = new ParamState();
