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
