
interface BatchOption {
    key: keyof BatchSettings['values'];
    /** classic localStorage key */
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

const read = (o: BatchOption): boolean => {
    const v = localStorage.getItem(o.storage);
    return v == null ? o.default : v === 'true';
};

export const BATCH_SIZE = { min: 48, max: 320, step: 8, default: 104 };
const SIZE_KEY = 'ahaBatchImageSize';
const clampSize = (n: number) => (Number.isFinite(n) ? Math.min(BATCH_SIZE.max, Math.max(BATCH_SIZE.min, Math.round(n))) : BATCH_SIZE.default);
const readSize = () => { const v = localStorage.getItem(SIZE_KEY); return v == null ? BATCH_SIZE.default : clampSize(Number(v)); };

class BatchSettings {
    values = $state({
        autoClear: false, autoSwapPreviews: false, autoSwapImages: true, showSpinners: true, separateBatches: false, playVideos: true,
    });

    constructor() {
        for (const o of BATCH_OPTIONS) {
            this.values[o.key] = read(o);
        }
    }

    imageSize = $state(readSize());

    setImageSize(px: number): void {
        this.imageSize = clampSize(px);
        localStorage.setItem(SIZE_KEY, `${this.imageSize}`);
    }

    set(key: BatchOption['key'], on: boolean): void {
        this.values[key] = on;
        const o = BATCH_OPTIONS.find(x => x.key === key)!;
        localStorage.setItem(o.storage, `${on}`);
    }
}

export const batchSettings = new BatchSettings();
