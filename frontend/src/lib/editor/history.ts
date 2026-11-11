import type { Layer, Rect } from './layer';

export interface HistoryEntry {
    label: string;
    undo(): void;
    redo(): void;
}

/** before/after pixels of one layer region (only the touched rect is kept, so big canvases stay cheap) */
export function pixelEntry(label: string, layer: Layer, rect: Rect, before: ImageData): HistoryEntry {
    const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    return {
        label,
        undo: () => layer.ctx.putImageData(before, rect.x, rect.y),
        redo: () => layer.ctx.putImageData(after, rect.x, rect.y),
    };
}

export class History {
    private done: HistoryEntry[] = [];
    private undone: HistoryEntry[] = [];

    constructor(private max = 40, private onchange: () => void = () => {}) {}

    get canUndo(): boolean {
        return this.done.length > 0;
    }

    get canRedo(): boolean {
        return this.undone.length > 0;
    }

    push(e: HistoryEntry): void {
        this.done.push(e);
        if (this.done.length > this.max) {
            this.done.shift();
        }
        this.undone = [];
        this.onchange();
    }

    undo(): boolean {
        const e = this.done.pop();
        if (!e) {
            return false;
        }
        e.undo();
        this.undone.push(e);
        this.onchange();
        return true;
    }

    redo(): boolean {
        const e = this.undone.pop();
        if (!e) {
            return false;
        }
        e.redo();
        this.done.push(e);
        this.onchange();
        return true;
    }

    clear(): void {
        this.done = [];
        this.undone = [];
        this.onchange();
    }
}
