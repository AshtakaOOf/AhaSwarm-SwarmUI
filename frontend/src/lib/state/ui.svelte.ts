import { load, save } from '../util/storage';
import { api } from '../api/swarm';
import { subFromHash, subHash } from '../nav';
import { toast as uiToast, THEMES, type ContrastMode } from '$ahakit';

function migrate(s: LocalSettings): LocalSettings {
    const stale = s as LocalSettings & { paramsWidth?: unknown; historyWidth?: unknown };
    delete stale.paramsWidth;
    delete stale.historyWidth;
    delete (stale as { hideClassicOnly?: unknown }).hideClassicOnly;
    // one global accent before themes had their own palettes: it becomes the dark and light themes' choice
    const old = s as LocalSettings & { accent?: string };
    if (typeof old.accent === 'string') {
        if (old.accent) {
            s.accents = { dark: old.accent, light: old.accent, ...s.accents };
        }
        delete old.accent;
    }
    s.accents = { ...s.accents };
    // the default dark theme was 'default' before every theme had its own file
    if (s.theme === 'default') {
        s.theme = 'dark';
    }
    if ('default' in s.accents) {
        s.accents = { dark: s.accents['default'], ...s.accents };
        delete s.accents['default'];
    }
    if (!THEMES.some(t => t.id === s.theme)) {
        s.theme = 'dark';
    }
    delete (s as LocalSettings & { highContrast?: unknown }).highContrast;
    if (!['auto', 'on', 'off'].includes(s.contrast)) {
        s.contrast = 'auto';
    }
    if (![80, 104, 160, 240].includes(s.historyThumbSize)) {
        s.historyThumbSize = defaults.historyThumbSize;
    }
    return s;
}

export type Page = 'generate' | 'simple' | 'utilities' | 'history' | 'models' | 'presets' | 'server' | 'settings';
// Classic-style bottom bar tabs on the Generate page
export type BottomTab = 'history' | 'presets' | 'Stable-Diffusion' | 'VAE' | 'LoRA' | 'Embedding' | 'ControlNet' | 'Wildcards' | 'tools';
const BOTTOM_PAGES: Record<string, BottomTab> = { history: 'history', presets: 'presets', models: 'Stable-Diffusion' };

export interface LocalSettings {
    showAdvanced: boolean;
    imageFit: 'contain' | 'cover';
    browserFit: 'contain' | 'cover';
    theme: string;
    contrast: ContrastMode;
    hideClassicButton: boolean;
    accents: Record<string, string>;
    lastCustomAccent: string;
    historyThumbSize: number;
    ctrlEnterGenerates: boolean;
    modelPlaceholder: 'icon' | 'swarm';
    imageActions: 'overlay' | 'above-metadata';
}

const defaults: LocalSettings = {
    showAdvanced: false,
    imageFit: 'contain',
    browserFit: 'contain',
    theme: 'dark',
    contrast: 'auto',
    accents: {},
    lastCustomAccent: '',
    hideClassicButton: false,
    historyThumbSize: 104,
    ctrlEnterGenerates: true,
    modelPlaceholder: 'icon',
    imageActions: 'overlay',
};

// classic hash: #<bottom tab>,<top tab>[,<sub tab or simple workflow>]
const TOP_HASH: Record<'generate' | 'simple' | 'utilities' | 'server' | 'settings', string> = {
    generate: 'Text2Image', simple: 'Simple', utilities: 'utilities_tab', server: 'server_tab', settings: 'user_tab',
};
const BOTTOM_HASH: Record<BottomTab, string> = {
    history: 'Image-History-Tab', presets: 'Presets-Tab', 'Stable-Diffusion': 'Models-Tab', VAE: 'Vaes-Tab', LoRA: 'Loras-Tab',
    Embedding: 'Embeddings-Tab', ControlNet: 'ControlNets-Tab', Wildcards: 'Wildcards-Tab', tools: 'Tools-Tab',
};
type SubOwner = 'utilities' | 'server' | 'settings';
type HashState = { page: Page; bottom?: BottomTab; sub?: [SubOwner, string]; simple?: string };
const keyOf = <K extends string>(map: Record<K, string>, v: string) => (Object.keys(map) as K[]).find(k => map[k] === v);

function parseHash(): HashState {
    const raw = location.hash.replace('#', '');
    if (!raw.includes(',')) {
        // older aha hashes: #server, #history, #simple/<workflow>
        const [h, rest] = raw.split(/\/(.*)/);
        if (h === 'server' || h === 'settings' || h === 'utilities') {
            return { page: h };
        }
        if (h === 'simple') {
            return { page: 'simple', simple: rest ? decodeURIComponent(rest) : undefined };
        }
        return { page: 'generate', bottom: BOTTOM_PAGES[h] };
    }
    const [b, t, s] = raw.split(',');
    const out: HashState = { page: keyOf(TOP_HASH, t) ?? 'generate', bottom: keyOf(BOTTOM_HASH, b) };
    if (t === 'server_tab' && s === 'Settings-Server') {
        // classic keeps server settings in the server tab; aha has them under settings
        out.page = 'settings';
        out.sub = ['settings', 'server'];
    }
    else if (out.page === 'simple' && s) {
        out.simple = decodeURIComponent(s);
    }
    else if (s && (out.page === 'utilities' || out.page === 'server' || out.page === 'settings')) {
        const id = subFromHash(out.page, s);
        if (id) {
            out.sub = [out.page, id];
        }
    }
    return out;
}

class UiState {
    page = $state<Page>('generate');
    simpleTarget = $state<string | null>(null);
    bottomTab = $state<BottomTab>(load<BottomTab>('bottomTab', 'history'));
    settings = $state<LocalSettings>(migrate({ ...defaults, ...load<Partial<LocalSettings>>('settings', {}) }));
    paramsOpen = $state(false);
    historyPath = $state<string | null>(null);
    historyFilter = $state<string | null>(null);
    confirmReq = $state<{ title: string; message: string; confirmLabel: string; danger: boolean; resolve: (ok: boolean) => void } | null>(null);
    // Promise-based confirm modal (AhaKit Modal), used instead of window.confirm for server/admin actions
    ask(title: string, message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
        this.confirmReq?.resolve(false);
        return new Promise(resolve => {
            this.confirmReq = { title, message, confirmLabel: opts.confirmLabel ?? 'Confirm', danger: opts.danger ?? true, resolve };
        });
    }
    sub = $state<Record<string, string>>({
        utilities: localStorage.getItem('ahaswarm.util.tab') ?? 'info',
        server: localStorage.getItem('ahaswarm.server.tab') ?? 'info',
        settings: localStorage.getItem('ahaswarm.settings.sub') ?? (localStorage.getItem('ahaswarm.settings.mode') === 'swarm' ? 'user' : 'aha'),
    });
    setSub(page: 'utilities' | 'server' | 'settings', id: string): void {
        this.sub[page] = id;
        localStorage.setItem(page === 'utilities' ? 'ahaswarm.util.tab' : page === 'server' ? 'ahaswarm.server.tab' : 'ahaswarm.settings.sub', id);
        this.syncHash();
    }
    setSimpleTarget(name: string | null): void {
        this.simpleTarget = name;
        this.syncHash();
    }

    private applying = false;
    // open whatever the url hash points at (boot, back/forward, edited hash)
    applyHash(): void {
        const h = parseHash();
        this.applying = true;
        if (h.bottom) {
            this.showBottom(h.bottom);
        }
        if (h.sub) {
            this.setSub(h.sub[0], h.sub[1]);
        }
        this.simpleTarget = h.simple ?? null;
        this.page = h.page;
        this.applying = false;
    }
    hash(): string {
        const top = this.page as keyof typeof TOP_HASH;
        let h = `#${BOTTOM_HASH[this.bottomTab] ?? ''},${TOP_HASH[top] ?? TOP_HASH.generate}`;
        if (top === 'simple' && this.simpleTarget) {
            h += `,${encodeURIComponent(this.simpleTarget)}`;
        }
        else if (top === 'utilities' || top === 'server' || top === 'settings') {
            const s = subHash(top, this.sub[top]);
            if (s) {
                h += `,${s}`;
            }
        }
        return h;
    }
    // classic updateHash pushes a history entry per tab switch
    syncHash(): void {
        if (this.applying) {
            return;
        }
        const h = this.hash();
        if (location.hash !== h) {
            history.pushState(null, '', h);
        }
    }
    tokenizeText = $state<string | null>(null);
    fullView = $state<{ src: string; metadata: string | null } | null>(null);

    go(page: Page, bottom?: BottomTab): void {
        if (page in BOTTOM_PAGES) {
            this.showBottom(bottom ?? BOTTOM_PAGES[page]);
            page = 'generate';
        }
        this.page = page;
        this.syncHash();
    }

    showBottom(tab: BottomTab): void {
        this.bottomTab = tab;
        save('bottomTab', tab);
        this.syncHash();
    }

    // bumped by openBottom; the generate page expands its browser pane on change
    bottomOpenReq = $state(0);
    // switch the bottom browser to a tab and expand it if collapsed
    openBottom(tab: BottomTab): void {
        this.showBottom(tab);
        this.bottomOpenReq++;
    }

    private settingsTimer: ReturnType<typeof setTimeout> | undefined;
    async loadSettings(): Promise<void> {
        const { settings } = await api.ahaGetSettings();
        if (settings && Object.keys(settings).length) {
            this.settings = migrate({ ...defaults, ...(settings as Partial<LocalSettings>) });
            save('settings', $state.snapshot(this.settings));
        }
        else {
            await api.ahaSaveSettings($state.snapshot(this.settings));
        }
    }

    saveSettings(): void {
        const snap = $state.snapshot(this.settings);
        save('settings', snap);
        clearTimeout(this.settingsTimer);
        this.settingsTimer = setTimeout(() => api.ahaSaveSettings(snap).catch(e => console.warn('AhaSaveSettings failed', e)), 600);
    }

    toast(message: string, kind: 'info' | 'success' | 'warning' | 'error' = 'info', timeout?: number): void {
        uiToast(message, { kind, ...(timeout !== undefined ? { timeout } : {}) });
    }

    error(e: unknown): void {
        const msg = e instanceof Error ? e.message : String(e);
        this.toast(msg, 'error');
    }
}

export const ui = new UiState();
ui.applyHash();
