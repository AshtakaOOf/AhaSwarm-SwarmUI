<script lang="ts">
    import { onMount } from 'svelte';
    import TopBar from './components/layout/TopBar.svelte';
    import GeneratePage from './components/generate/GeneratePage.svelte';
    import ConfirmHost from './components/layout/ConfirmHost.svelte';
    import LoginView from './components/layout/LoginView.svelte';
    import FullView from './components/generate/FullView.svelte';
    import { ToastContainer, ProgressBar, Button, setTheme, applyContrastMode, setAccent } from './components/ui';
    import { ui } from './lib/state/ui.svelte';
    import { paramState } from './lib/state/params.svelte';
    import { gen } from './lib/state/gen.svelte';
    import { newSession, impersonating, stopImpersonating, getSessionInfo, onSession, SwarmApiError } from './lib/api/client';
    import LVenetian from '@lucide/svelte/icons/venetian-mask';
    import { userSettings } from './lib/state/usersettings.svelte';
    import { presetState } from './lib/state/presets.svelte';
    import { ensureCurrentModel } from './lib/state/models';
    import type { Component } from 'svelte';
    import type { Page } from './lib/state/ui.svelte';
    import { installNavGuard } from './lib/util/navGestures';

    // pages other than Generate are separate chunks, loaded and mounted on first visit, then kept alive
    const LAZY: Partial<Record<Page, () => Promise<{ default: Component }>>> = {
        simple: () => import('./components/simple/SimplePage.svelte'),
        utilities: () => import('./components/utilities/UtilitiesPage.svelte'),
        server: () => import('./components/server/ServerPage.svelte'),
        settings: () => import('./components/settings/SettingsPage.svelte'),
    };
    const lazyPages = Object.keys(LAZY) as Page[];
    const chunks: Partial<Record<Page, Promise<{ default: Component }>>> = {};
    const chunk = (id: Page) => (chunks[id] ??= LAZY[id]!());
    let visited = $state<Partial<Record<Page, boolean>>>({});
    $effect(() => {
        visited[ui.page] = true;
    });
    $effect(() => {
        document.documentElement.style.setProperty('--bf-fit', ui.settings.browserFit);
    });
    $effect(() => { setTheme(ui.settings.theme); });
    $effect(() => applyContrastMode(ui.settings.contrast));
    $effect(() => setAccent(ui.settings.accents[ui.settings.theme] ?? ''));

    let bootError = $state<string | null>(null);
    let needsLogin = $state(false);
    let booted = $state(false);
    // classic getSession: a changed server version means this page's API may no longer match
    let serverVersion: string | null = null;
    onSession(s => {
        if (!s.version || serverVersion === s.version) return;
        const first = serverVersion == null;
        serverVersion = s.version;
        if (!first) ui.toast('The server has updated since you opened the page, please refresh.', 'warning', 0);
    });

    async function boot() {
        bootError = null;
        needsLogin = false;
        try {
            await newSession();
            ui.clampAccess();
            gen.startStatusPolling();
            await Promise.all([
                userSettings.load().catch(e => console.warn('GetUserSettings failed', e)),
                presetState.load().catch(e => console.warn('GetMyUserData failed', e)),
                ui.loadSettings().catch(e => console.warn('AhaGetSettings failed', e)),
                paramState.loadInstallFeatures().catch(e => console.warn('AhaGetInstallFeatures failed', e)),
            ]);
            await paramState.load();
            const def = presetState.all.find(p => p.title.toLowerCase() === 'default');
            if (!paramState.restored && def) {
                presetState.applyOne(def);
            }
            ensureCurrentModel();
            booted = true;
        }
        catch (e) {
            if (e instanceof SwarmApiError && (e.errorId === 'needs_login' || /login|unauthorized/i.test(e.message))) {
                needsLogin = true;
                return;
            }
            bootError = e instanceof Error ? e.message : String(e);
        }
    }

    let topEl = $state<HTMLDivElement>();
    $effect(() => {
        const el = topEl;
        if (!el) {
            return;
        }
        const set = () => document.documentElement.style.setProperty('--app-top', `${el.offsetHeight}px`);
        const ro = new ResizeObserver(set);
        ro.observe(el);
        set();
        return () => {
            ro.disconnect();
            document.documentElement.style.removeProperty('--app-top');
        };
    });

    onMount(() => {
        boot();
        const onHash = () => ui.applyHash();
        window.addEventListener('hashchange', onHash);
        window.addEventListener('popstate', onHash);
        const stopNav = installNavGuard();
        return () => {
            window.removeEventListener('hashchange', onHash);
            window.removeEventListener('popstate', onHash);
            stopNav();
        };
    });

    // persist params (debounced) whenever they change
    const MEDIA_TYPES = ['image', 'image_list', 'audio', 'audio_list', 'video', 'video_list'];
    let persistTimer: number | undefined;
    $effect(() => {
        for (const p of paramState.params) {
            if (!MEDIA_TYPES.includes(p.type)) {
                JSON.stringify(paramState.values[p.id]);
            }
        }
        JSON.stringify(paramState.toggles);
        JSON.stringify(paramState.groupToggles);
        JSON.stringify(paramState.groupOpen);
        clearTimeout(persistTimer);
        persistTimer = window.setTimeout(() => paramState.persist(), 400);
    });
    $effect(() => {
        void paramState.values['aspectratio'];
        void paramState.values['sidelength'];
        void paramState.toggles['sidelength'];
        paramState.applyAspectRatio();
    });
</script>

<div class="app" style="--thumb: {ui.settings.historyThumbSize}px">
    <div class="top" bind:this={topEl}>
        <TopBar brandOnly={needsLogin} />
        {#if booted && impersonating}
            <div class="imp ui-dense" role="status"><LVenetian size={14} aria-hidden="true" /><span>You are impersonating user: <b>{getSessionInfo()?.user_id ?? impersonating}</b></span><Button size="sm" onclick={stopImpersonating}>Stop impersonating</Button></div>
        {/if}
    </div>
    <main class="content">
        <svelte:boundary onerror={(e) => console.error('AhaSwarm UI error', e)}>
            {#snippet failed(error, reset)}
                <div class="boot">
                    <h2>Something broke in the UI</h2>
                    <p>{error instanceof Error ? error.message : String(error)}</p>
                    <div class="boot-acts">
                        <Button onclick={reset}>Try again</Button>
                        <Button variant="primary" onclick={() => location.reload()}>Reload</Button>
                    </div>
                </div>
            {/snippet}
            {#if needsLogin}
                <div class="boot">
                    <LoginView onsuccess={boot} />
                </div>
            {:else if bootError}
                <div class="boot">
                    <h2>Can't reach SwarmUI</h2>
                    <p>{bootError}</p>
                    <Button variant="primary" onclick={boot}>Retry</Button>
                </div>
            {:else if !booted}
                <div class="boot"><ProgressBar value={null} label="Connecting to SwarmUI…" /></div>
            {:else}
                <div class="panes">
                    <div class="pane" class:on={ui.page === 'generate'}><GeneratePage /></div>
                    {#each lazyPages as id (id)}
                        {#if visited[id]}
                            <div class="pane" class:on={ui.page === id}>
                                {#await chunk(id)}<div class="boot"><ProgressBar value={null} label="Loading…" /></div>{:then m}<m.default />{:catch e}<div class="boot"><p>{e instanceof Error ? e.message : String(e)}</p><Button variant="primary" onclick={() => location.reload()}>Reload</Button></div>{/await}
                            </div>
                        {/if}
                    {/each}
                </div>
                <FullView />
            {/if}
        </svelte:boundary>
    </main>
</div>
<ConfirmHost />
<ToastContainer anchor={'[aria-label="Generate controls"] .ui-group-btns'} />

<style>
    .app { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); height: 100%; height: 100dvh; }
    @media (max-width: 768px) { .app { overscroll-behavior-x: none; } }
    .content { min-height: 0; overflow: hidden; }
    .top { min-width: 0; }
    .imp { display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-1) var(--space-2); background: var(--color-warning-bg); color: var(--color-warning-fg); font-size: var(--text-ui, 13px); }
    .panes { height: 100%; min-height: 0; }
    .pane { display: none; height: 100%; min-height: 0; }
    .pane.on { display: flex; flex-direction: column; }
    .boot { max-width: 420px; margin: 15vh auto; padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); --color-progress: var(--color-accent); }
    .boot-acts { display: flex; gap: var(--space-2); }
</style>
