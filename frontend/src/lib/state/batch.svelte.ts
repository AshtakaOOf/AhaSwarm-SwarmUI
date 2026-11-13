import { afterSettingsLoad, ui, type OutputOptions } from './ui.svelte';

type FlagKey = keyof OutputOptions;

interface BatchOption {
    key: FlagKey;
    // classic localStorage key
    storage: string;
    label: string;
    description: string;
    default: boolean;
}

export const BATCH_OPTIONS: BatchOption[] = [
    { key: 'autoClear', storage: 'autoClearBatch', label: 'Auto clear batch', default: false,
        description: 'Clear the batch when a new generation starts. Otherwise it grows until you reload the page.' },
    { key: 'autoSwapPreviews', storage: 'autoLoadPreviews', label: 'Auto swap to previews', default: false,
        description: 'Show live previews of new images in the current image area while they generate.' },
    { key: 'autoSwapImages', storage: 'autoLoadImages', label: 'Auto swap to images', default: true,
        description: 'Show each new image as the current image as soon as it is done.' },
    { key: 'showSpinners', storage: 'showLoadSpinners', label: 'Show load spinners', default: true,
        description: 'Show spinners on images that are generating, and failed generations.' },
    { key: 'separateBatches', storage: 'separateBatches', label: 'Separate batches', default: false,
        description: 'Keep the images of each generation together, so concurrent generations do not mix.' },
    { key: 'playVideos', storage: 'playBatchVideos', label: 'Play videos', default: true,
        description: 'Play video outputs in the batch (muted). Otherwise they stay paused.' },
];

export const BATCH_SIZE = { min: 48, max: 320, step: 8, default: 104 };
const SIZE_KEY = 'ahaBatchImageSize';
const clampSize = (n: number) => (Number.isFinite(n) ? Math.min(BATCH_SIZE.max, Math.max(BATCH_SIZE.min, Math.round(n))) : BATCH_SIZE.default);
const readSize = () => { const v = localStorage.getItem(SIZE_KEY); return v == null ? BATCH_SIZE.default : clampSize(Number(v)); };

const OUTPUT_DEFAULTS = {} as OutputOptions;
for (const opt of BATCH_OPTIONS) {
    OUTPUT_DEFAULTS[opt.key] = opt.default;
}

function flag(v: unknown, d: boolean): boolean {
    return typeof v === 'boolean' ? v : d;
}

function normalize(raw: Partial<OutputOptions> | undefined): OutputOptions {
    return {
        autoClear: flag(raw?.autoClear, OUTPUT_DEFAULTS.autoClear),
        autoSwapPreviews: flag(raw?.autoSwapPreviews, OUTPUT_DEFAULTS.autoSwapPreviews),
        autoSwapImages: flag(raw?.autoSwapImages, OUTPUT_DEFAULTS.autoSwapImages),
        showSpinners: flag(raw?.showSpinners, OUTPUT_DEFAULTS.showSpinners),
        separateBatches: flag(raw?.separateBatches, OUTPUT_DEFAULTS.separateBatches),
        playVideos: flag(raw?.playVideos, OUTPUT_DEFAULTS.playVideos),
    };
}

// classic keys until the user file has output, and the mirror so classic in this browser matches
function fromLocal(): OutputOptions {
    const o = { ...OUTPUT_DEFAULTS };
    for (const opt of BATCH_OPTIONS) {
        const v = localStorage.getItem(opt.storage);
        if (v === 'true' || v === 'false') {
            o[opt.key] = v === 'true';
        }
    }
    return o;
}

function writeLocal(o: OutputOptions): void {
    for (const opt of BATCH_OPTIONS) {
        localStorage.setItem(opt.storage, `${o[opt.key]}`);
    }
}

function current(): OutputOptions {
    return normalize(ui.settings.output);
}

class BatchSettings {
    values = $derived.by(() => {
        const o = current();
        return {
            autoClear: o.autoClear, autoSwapPreviews: o.autoSwapPreviews, autoSwapImages: o.autoSwapImages,
            showSpinners: o.showSpinners, separateBatches: o.separateBatches, playVideos: o.playVideos,
        };
    });

    imageSize = $state(readSize());

    setImageSize(px: number): void {
        this.imageSize = clampSize(px);
        localStorage.setItem(SIZE_KEY, `${this.imageSize}`);
    }

    set(key: FlagKey, on: boolean): void {
        this.store({ ...current(), [key]: on });
    }

    private store(next: OutputOptions): void {
        ui.settings.output = next;
        writeLocal(next);
        ui.saveSettings();
    }
}

if (!ui.settings.output) {
    ui.settings.output = fromLocal();
}
afterSettingsLoad(() => {
    if (ui.settings.output) {
        writeLocal(current());
    }
});

export const batchSettings = new BatchSettings();
