import { api } from '../api/swarm';
import type { CurrentStatus, GenWSMessage } from '../api/types';
import type { WSHandle } from '../api/client';
import { paramState } from './params.svelte';
import { ui } from './ui.svelte';
import { presetState } from './presets.svelte';
import { userSettings } from './usersettings.svelte';
import { batchSettings } from './batch.svelte';
import { parseMetadata } from '../util/metadata';

export interface OutputImage {
    src: string;
    metadata: string | null;
    batch: string;
    jobId: number;
    time: number;
    /** output Intermediate Images: a stage before the final image (eg before the refiner) */
    intermediate?: boolean;
    /** the mini grid of all images, sent after a multi-image generation */
    grid?: boolean;
    set?: string;
    ratio?: string;
}

function imageSetKey(jobId: number, batchIndex: number, src: string, metadata: string | null): string {
    const p = batchIndex === -1 ? null : parseMetadata(metadata)?.params;
    if (p?.seed == null) {
        return `${jobId}|${src}`;
    }
    return `${jobId}|${p.seed}|${p.variationseed ?? ''}`;
}
export function imageSets(outputs: OutputImage[]): OutputImage[][] {
    const sets = new Map<string, OutputImage[]>();
    for (const o of outputs) {
        const k = o.set ?? `${o.jobId}|${o.src}`;
        const list = sets.get(k);
        if (list) {
            list.push(o);
        }
        else {
            sets.set(k, [o]);
        }
    }
    // the final image leads its set even when a later stage (eg a second intermediate) arrived after it
    return [...sets.values()].map(s => (s.length > 1 ? [...s.filter(o => !o.intermediate), ...s.filter(o => o.intermediate)] : s));
}

const MAX_OUTPUTS = 300;
const MAX_DATA_OUTPUTS = 30;
function capOutputs(list: OutputImage[]): OutputImage[] {
    let data = 0;
    const kept = list.filter(o => !o.src.startsWith('data:') || ++data <= MAX_DATA_OUTPUTS);
    return kept.length > MAX_OUTPUTS ? kept.slice(0, MAX_OUTPUTS) : kept;
}

function requestedRatio(input: Record<string, unknown>): string | undefined {
    const w = Number(input['width']), h = Number(input['height']);
    return w > 0 && h > 0 ? `${w} / ${h}` : undefined;
}

const outputKind = (batchIndex: string | number, metadata: string | null) => {
    const i = Number(batchIndex);
    return { grid: i === -1, intermediate: i <= -10 || !!parseMetadata(metadata)?.extra['intermediate'] };
};

export interface Slot {
    key: string;
    index: number;
    overall: number;
    current: number;
    preview: string | null;
    done: boolean;
}

export interface Job {
    id: number;
    images: number;
    prompt: string;
    started: number;
    state: 'running' | 'done' | 'error' | 'interrupted';
    slots: Record<string, Slot>;
    /** requested width / height as a CSS aspect ratio (placeholders and previews take it before an image exists) */
    ratio?: string;
    key?: string;
    error?: string;
    handle?: WSHandle;
}

let jobCounter = 0;

class GenState {
    jobs = $state<Job[]>([]);
    /** newest first */
    outputs = $state.raw<OutputImage[]>([]);
    current = $state.raw<OutputImage | null>(null); // swapped whole, never mutated
    livePreview = $state<string | null>(null);
    status = $state<CurrentStatus | null>(null);
    statusError = $state<string | null>(null);
    forever = $state(false);
    private timer: number | undefined;
    private pollMs = 0;
    private statusKey = '';
    private foreverTimer: number | undefined;
    private lastForeverParams: string | null = null;

    running = $derived(this.jobs.filter(j => j.state === 'running'));
    batchGroups = $derived.by(() => {
        if (!batchSettings.values.separateBatches) {
            return [{ jobId: 0, sets: imageSets(this.outputs) }];
        }
        const groups = new Map<number, OutputImage[]>();
        for (const o of this.outputs) {
            if (!groups.has(o.jobId)) {
                groups.set(o.jobId, []);
            }
            groups.get(o.jobId)!.push(o);
        }
        return [...groups].map(([jobId, outputs]) => ({ jobId, sets: imageSets(outputs) }));
    });
    ordered = $derived(this.batchGroups.flatMap(g => g.sets.flat()));
    progress = $derived.by(() => {
        const slots = this.running.flatMap(j => Object.values(j.slots)).filter(s => !s.done);
        if (!slots.length) {
            return null;
        }
        const overall = slots.reduce((a, s) => a + s.overall, 0) / slots.length;
        const current = slots.reduce((a, s) => a + s.current, 0) / slots.length;
        return { overall, current, count: slots.length };
    });

    startStatusPolling(): void {
        const tick = async () => {
            if (document.hidden) {
                return;
            }
            try {
                const st = await api.getCurrentStatus();
                this.applyStatus(st);
                this.statusError = null;
            }
            catch (e) {
                this.statusError = e instanceof Error ? e.message : String(e);
            }
        };
        tick();
        this.schedulePoll(2000);
        this.pollTick = tick;
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                tick();
            }
        });
    }

    private pollTick: (() => void) | null = null;

    /** classic reviseStatusBar: poll every 2s while the status bar has something to say, otherwise every 60s */
    private schedulePoll(ms: number): void {
        if (ms === this.pollMs) {
            return;
        }
        this.pollMs = ms;
        clearInterval(this.timer);
        this.timer = window.setInterval(() => this.pollTick?.(), ms);
    }

    applyStatus(st: Partial<CurrentStatus>): void {
        if (!st) {
            return;
        }
        const next = { ...(this.status ?? {} as CurrentStatus), ...st } as CurrentStatus;
        const key = JSON.stringify(next);
        const changed = key !== this.statusKey;
        if (changed) {
            this.statusKey = key;
            this.status = next;
        }
        if (this.pollMs) {
            const g = next.status, b = next.backend_status;
            const working = !!(g && (g.waiting_gens || g.live_gens || g.loading_models || g.waiting_backends)) || this.running.length > 0;
            const msg = !!(b as any)?.class;
            this.schedulePoll(working || (msg && changed) ? 2000 : msg ? Math.min(60000, this.pollMs * 2) : 60000);
        }
        if (st.supported_features && JSON.stringify(st.supported_features) !== JSON.stringify(paramState.serverFeatures)) {
            paramState.serverFeatures = st.supported_features;
        }
    }

    generate(overrides: Record<string, any> = {}, withPresets = true): void {
        if (!paramState.loaded) {
            ui.toast('Parameters are still loading.', 'warning');
            return;
        }
        const input = paramState.buildInput(overrides);
        if (withPresets && presetState.current.length) {
            input['presets'] = [...presetState.current]; // classic getGenInput: server applies the current preset stack
        }
        if (!input['model']) {
            ui.toast('Pick a model first (Models tab or the model selector).', 'warning');
            return;
        }
        this.startJob(input, (on) => api.generateWS(input, on), !!overrides['_preview']);
    }

    currentInput(): Record<string, any> {
        const input = paramState.buildInput();
        if (presetState.current.length) {
            input['presets'] = [...presetState.current];
        }
        return input;
    }

    stream(baseParams: Record<string, any>, connect: (onMessage: (m: GenWSMessage) => void) => WSHandle): void {
        if (!paramState.loaded) {
            ui.toast('Parameters are still loading.', 'warning');
            return;
        }
        if (!baseParams['model']) {
            ui.toast('Pick a model first (Models tab or the model selector).', 'warning');
            return;
        }
        this.startJob({ ...baseParams }, connect, false);
    }

    private startJob(input: Record<string, any>, connect: (onMessage: (m: GenWSMessage) => void) => WSHandle, isPreview: boolean): void {
        if (batchSettings.values.autoClear && !isPreview) {
            this.outputs = []; // classic resetBatchIfNeeded
        }
        const images = Math.max(1, Number(input['images'] ?? 1));
        input['images'] = images;
        const job: Job = {
            id: ++jobCounter,
            images,
            prompt: `${input['prompt'] ?? ''}`,
            started: Date.now(),
            state: 'running',
            slots: {},
            ratio: requestedRatio(input),
            key: JSON.stringify(Object.entries(input).filter(([k]) => k !== 'seed').sort(([a], [b]) => a.localeCompare(b))),
        };
        this.jobs.unshift(job);
        const live = this.jobs[0];
        const slot = (bi: string): Slot => {
            const key = `${live.id}-${bi}`;
            if (!live.slots[key]) {
                live.slots[key] = { key, index: Number(bi), overall: 0, current: 0, preview: null, done: false };
            }
            return live.slots[key];
        };
        for (let i = 0; i < images; i++) {
            slot(`${i}`);
        }
        live.handle = connect((m: GenWSMessage) => {
            if (m.status || m.backend_status || m.supported_features) {
                this.applyStatus(m as CurrentStatus);
            }
            if (m.gen_progress) {
                const s = slot(`${m.gen_progress.batch_index}`);
                s.overall = m.gen_progress.overall_percent ?? s.overall;
                s.current = m.gen_progress.current_percent ?? s.current;
                if (m.gen_progress.preview) {
                    s.preview = m.gen_progress.preview;
                    this.livePreview = m.gen_progress.preview;
                }
            }
            if (m.image) {
                if (Number(m.image.batch_index) >= 0) {
                    const s = slot(`${m.image.batch_index}`);
                    s.done = true;
                    s.preview = null;
                }
                // A message without a path must not become the current image (it would break the image views)
                if (m.image.image) {
                    const out: OutputImage = {
                        src: m.image.image,
                        metadata: m.image.metadata,
                        batch: `${m.image.batch_index}`,
                        jobId: live.id,
                        time: Date.now(),
                        ...outputKind(m.image.batch_index, m.image.metadata),
                        set: imageSetKey(live.id, Number(m.image.batch_index), m.image.image, m.image.metadata),
                        ratio: Number(m.image.batch_index) === -1 ? undefined : live.ratio,
                    };
                    if (!isPreview) {
                        this.outputs = capOutputs([out, ...this.outputs]);
                    }
                    // classic gotImageResult: swap unless Auto Swap To Images is off and something is shown
                    if (isPreview || batchSettings.values.autoSwapImages || !this.current) {
                        this.current = out;
                    }
                    this.livePreview = null;
                }
            }
            if (m.discard_indices) {
                const discard = new Set(m.discard_indices.map(String));
                this.outputs = this.outputs.filter(o => !(o.jobId === live.id && discard.has(o.batch)));
            }
        });
        live.handle.done.then(() => {
            if (live.state === 'running') {
                live.state = 'done';
            }
        }).catch((e) => {
            if (live.state === 'running') {
                live.state = 'error';
                live.error = e instanceof Error ? e.message : String(e);
                ui.error(e);
            }
        }).finally(() => {
            for (const s of Object.values(live.slots)) {
                s.done = true;
            }
            if (!this.running.length) {
                this.livePreview = null;
            }
            this.jobs = this.jobs.filter((j, i) => j.state === 'running' || i < 12);
        });
    }

    setForever(on: boolean): void {
        this.forever = on;
        clearInterval(this.foreverTimer);
        this.lastForeverParams = null;
        if (!on) {
            return;
        }
        const delay = Math.max(Math.round(parseFloat(`${userSettings.get('generateforeverdelay', '0.1')}`) * 1000) || 0, 1);
        const minQueue = Math.max(1, parseInt(`${userSettings.get('generateforeverqueuesize', '1')}`) || 1);
        this.foreverTimer = window.setInterval(() => {
            if (this.running.length >= minQueue || !paramState.loaded) {
                return;
            }
            const all = paramState.buildInput();
            if (all['seed'] != -1 && all['variationseed'] != -1) {
                const key = JSON.stringify(all);
                if (key === this.lastForeverParams) {
                    return;
                }
                this.lastForeverParams = key;
            }
            this.generate();
        }, delay);
    }

    previews = $state(false);
    private previewTimer: number | undefined;
    private lastPreviewParams: string | null = null;

    async setPreviews(on: boolean): Promise<void> {
        clearInterval(this.previewTimer);
        this.lastPreviewParams = null;
        if (on && !presetState.get('Preview')) {
            const lcm = (paramState.byId['loras']?.values ?? []).find(m => m.toLowerCase().includes('sdxl_lcm'));
            if (lcm && confirm(`Generate Previews uses a preset named "Preview", which you don't have.\nYou have a LoRA named "${lcm}" - create an LCM Preview preset from it?`)) {
                try {
                    await api.addNewPreset('Preview', '(Auto-generated) LCM Preview Preset, used when "Generate Previews" is clicked',
                        { loras: lcm, loraweights: '1', steps: 4, cfgscale: 1, sampler: 'lcm', scheduler: 'normal' });
                    await presetState.load();
                }
                catch (e) {
                    ui.error(e);
                    return;
                }
            }
            else if (!confirm('Generate Previews works best with a preset named "Preview" (eg an LCM or Turbo setup), which you don\'t have.\nGenerate previews with your current parameters anyway?')) {
                return;
            }
        }
        this.previews = on;
        if (!on) {
            return;
        }
        if (Number(paramState.values['seed']) === -1) {
            paramState.values['seed'] = 1;
        }
        this.previewTimer = window.setInterval(() => {
            if (!this.running.length && paramState.loaded) {
                this.genOnePreview();
            }
        }, 100);
    }

    private genOnePreview(): void {
        const key = JSON.stringify(paramState.buildInput());
        if (key === this.lastPreviewParams) {
            return;
        }
        this.lastPreviewParams = key;
        const overrides: Record<string, any> = {};
        const preset = presetState.get('Preview');
        for (const [k, raw] of Object.entries(preset?.param_map ?? {})) {
            if (!paramState.byId[k]) {
                continue;
            }
            let val: any = raw;
            const cur = paramState.values[k];
            if (typeof val === 'string' && val.includes('{value}')) {
                val = val.replace('{value}', `${cur ?? ''}`);
            }
            else if ((k === 'loras' || k === 'loraweights') && cur && (!Array.isArray(cur) || cur.length)) {
                val = `${Array.isArray(cur) ? cur.join(',') : cur},${val}`;
            }
            overrides[k] = val;
        }
        overrides['_preview'] = true;
        overrides['donotsave'] = true;
        overrides['images'] = 1;
        for (const p of paramState.params) {
            if (p.do_not_preview) {
                overrides[p.id] = null;
            }
        }
        this.generate(overrides, false);
    }

    setCurrent(src: string, metadata: string | null, batch = 'history'): void {
        this.current = { src, metadata, batch, jobId: 0, time: Date.now() };
        this.livePreview = null;
    }

    async interrupt(allSessions = false): Promise<void> {
        this.setForever(false);
        if (this.previews) {
            this.setPreviews(false);
        }
        try {
            await api.interruptAll(allSessions);
        }
        catch (e) {
            ui.error(e);
        }
        for (const j of this.running) {
            j.state = 'interrupted';
            j.handle?.close();
        }
        this.livePreview = null;
    }

    clearQueueHistory(): void {
        this.jobs = this.jobs.filter(j => j.state === 'running');
    }
}

export const gen = new GenState();
