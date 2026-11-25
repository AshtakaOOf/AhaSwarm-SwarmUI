import { toast } from './ahakit/toasts.svelte';

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

export const pwa = $state({ prompt: null as InstallPrompt | null, installed: false });

pwa.installed = typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwa.prompt = e as InstallPrompt;
});
addEventListener('appinstalled', () => {
    pwa.prompt = null;
    pwa.installed = true;
});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]')) {
    addEventListener('load', () => {
        const url = new URL('sw.js', document.baseURI);
        const scope = new URL('.', document.baseURI);
        navigator.serviceWorker.register(url, { scope: scope.href }).catch(() => {});
    });
}

export function openExternal(url: string): void {
    if (pwa.installed) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    else {
        location.href = url;
    }
}

export async function install() {
    const p = pwa.prompt;
    if (!p) {
        return;
    }
    pwa.prompt = null;
    p.prompt();
    if ((await p.userChoice).outcome === 'accepted') {
        pwa.installed = true;
    }
}

const LOADED = `${__AHA_VERSION__}-${__AHA_COMMIT__}`;
let promptedFor: string | null = null;

function metaContent(html: string, name: string): string | null {
    const tag = html.match(new RegExp(`<meta\\s[^>]*name=["']${name}["'][^>]*>`, 'i'))?.[0];
    return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

async function servedVersion(): Promise<string | null> {
    const url = new URL('index.html', document.baseURI);
    url.searchParams.set('t', String(Date.now()));
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return metaContent(await res.text(), 'aha-version');
}

export async function updateAndReload(): Promise<void> {
    try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
            const ready = new Promise<void>((resolve) => {
                const done = () => {
                    navigator.serviceWorker.removeEventListener('controllerchange', done);
                    resolve();
                };
                navigator.serviceWorker.addEventListener('controllerchange', done);
                setTimeout(done, 1500);
            });
            await reg.update();
            reg.waiting?.postMessage('skipWaiting');
            await ready;
        }
    }
    catch {
        // reloads anyway (tsundere)
    }
    location.reload();
}

export async function checkAppVersion(forceServed?: string): Promise<void> {
    try {
        const served = forceServed ?? await servedVersion();
        if (!served || served === LOADED || promptedFor === served) return;
        promptedFor = served;
        toast('A new version of AhaSwarm is available.', {
            kind: 'warning',
            timeout: 0,
            action: { label: 'Reload', onclick: () => { void updateAndReload(); } },
        });
    }
    catch {
        // da failed check stays quiet (dom)
    }
}

if (import.meta.env.DEV) {
    (window as Window & { __ahaCheckVersion?: typeof checkAppVersion }).__ahaCheckVersion = checkAppVersion;
}
