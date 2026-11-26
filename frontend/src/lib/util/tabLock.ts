// holds a Web Lock so Chrome skips freezing or discarding this tab
let release: (() => void) | null = null;

export function keepTabAwake(on: boolean): void {
    if (!on) {
        release?.();
        release = null;
        return;
    }
    if (release || !navigator.locks?.request) {
        return;
    }
    let settled = false;
    const held = new Promise<void>((resolve) => {
        release = () => {
            if (!settled) {
                settled = true;
                resolve();
            }
        };
    });
    navigator.locks.request('ahaswarm-tab', () => held).catch(() => {
        release = null;
    });
}
