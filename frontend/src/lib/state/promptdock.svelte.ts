import { load, save } from '../util/storage';

class PromptDock {
    pinned = $state(load<boolean>('prompt.pinned', false));
    negOpen = $state(load<boolean>('prompt.negOpen', true));
    open = $state(load<boolean>('prompt.open', true));

    setPinned(v: boolean): void {
        this.pinned = v;
        save('prompt.pinned', v);
    }
    setNegOpen(v: boolean): void {
        this.negOpen = v;
        save('prompt.negOpen', v);
    }
    setOpen(v: boolean): void {
        this.open = v;
        save('prompt.open', v);
    }
}
export const promptDock = new PromptDock();
