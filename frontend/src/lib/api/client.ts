import type { SessionInfo } from './types';
import { prehashPassword } from '../util/password';

export class SwarmApiError extends Error {
    constructor(message: string, public errorId?: string, public data?: any) {
        super(message);
    }
}

function computeRoot(): string {
    const override = (window as any).AHASWARM_ROOT as string | undefined;
    if (override) {
        return override.endsWith('/') ? override : override + '/';
    }
    const path = location.pathname;
    const idx = path.toLowerCase().lastIndexOf('/aha/');
    if (idx >= 0) {
        return location.origin + path.substring(0, idx + 1);
    }
    return location.origin + '/';
}

export const swarmRoot = computeRoot();

export function resolveUrl(path: string | null | undefined): string {
    if (!path) {
        return '';
    }
    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
        return path;
    }
    return swarmRoot + (path.startsWith('/') ? path.substring(1) : path).split('/').map(encodeSegment).join('/');
}

function encodeSegment(s: string): string {
    const q = s.indexOf('?');
    if (q >= 0) {
        return encodeURIComponent(s.substring(0, q)) + s.substring(q);
    }
    return encodeURIComponent(s);
}

let session: SessionInfo | null = null;
let sessionPromise: Promise<SessionInfo> | null = null;
const sessionListeners: ((s: SessionInfo) => void)[] = [];

// classic impersonateTargetUserId
export let impersonating: string | null = new URLSearchParams(location.search).get('impersonate')?.trim() || null;

export function stopImpersonating(): void {
    const url = new URL(location.href);
    url.searchParams.delete('impersonate');
    location.href = url.toString();
}

export type LoginProvider = { id: string; label: string; clientId: string };

export async function getLoginOptions(): Promise<{ password: boolean; providers: LoginProvider[]; swarmVersion: string }> {
    try {
        const res = await fetch(`${swarmRoot}Login`, { credentials: 'same-origin' });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const ver = html.match(/[?&]vary=([0-9][^"'\s&]*)/)?.[1] ?? '';
        const g = doc.querySelector('#g_id_onload');
        const clientId = g?.getAttribute('data-client_id')?.trim() ?? '';
        const providers: LoginProvider[] = g && clientId ? [{ id: 'google', label: 'Sign in with Google', clientId }] : [];
        return { password: !!doc.querySelector('#username_input'), providers, swarmVersion: ver };
    }
    catch {
        return { password: true, providers: [], swarmVersion: '' };
    }
}

export async function loginWithGoogle(credential: string): Promise<{ success?: boolean; error?: string }> {
    const res = await fetch(`${swarmRoot}GoogleOAuthVerify`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ credential }),
    });
    const html = await res.text();
    if (/window\.location\.href\s*=\s*["']Text2Image["']/.test(html)) return { success: true };
    if (/oauthTrackerKey|doRegisterOAuth/.test(html)) return { error: 'This Google account is not linked to a SwarmUI user.' };
    return { error: 'Google sign-in failed.' };
}

export async function login(username: string, password: string): Promise<{ success?: boolean | string; error_id?: string }> {
    const res = await fetch(`${swarmRoot}API/Login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password: await prehashPassword(username, password) }),
    });
    try {
        return await res.json();
    }
    catch {
        return { error_id: 'unknown' };
    }
}

export function getSessionInfo(): SessionInfo | null {
    return session;
}

export function onSession(cb: (s: SessionInfo) => void): void {
    sessionListeners.push(cb);
    if (session) {
        cb(session);
    }
}

// no abort: these wait on git, installs, backend shutdown, or a full model/image scan
const NO_ABORT = new Set([
    'UpdateAndRestart', 'ShutdownServer', 'RestartBackends',
    'ToggleBackend', 'EditBackend', 'DeleteBackend', 'FreeBackendMemory',
    'SelectModel', 'TriggerRefresh',
    'InstallExtension', 'UpdateExtension', 'UninstallExtension', 'ComfyInstallFeatures',
    'ListModels', 'ListImages', 'CheckForUpdates',
    'Pickle2SafeTensor', 'WipeMetadata', 'GetModelHash',
    'ForwardImageRequest', 'ForwardMetadataRequest',
]);

function timeoutFor(route: string): number {
    if (route === 'GetNewSession') return 20_000;
    if (route === 'GetCurrentStatus') return 5_000;
    if (NO_ABORT.has(route)) return 0;
    return 120_000;
}

function stalled(e: unknown): boolean {
    return e instanceof TypeError || (e instanceof Error && e.name === 'AbortError');
}

async function postJson(route: string, body: any): Promise<any> {
    const ms = timeoutFor(route);
    const ctrl = new AbortController();
    const timer = ms ? setTimeout(() => ctrl.abort(), ms) : 0;
    try {
        const res = await fetch(`${swarmRoot}API/${route}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body),
            ...(ms ? { signal: ctrl.signal } : {}),
        });
        try {
            return await res.json();
        }
        catch (e) {
            if (stalled(e)) throw e;
            throw new SwarmApiError(`Server returned ${res.status} for ${route}`);
        }
    }
    catch (e) {
        if (e instanceof SwarmApiError) throw e;
        // a fetch with no timeout holds one of the browser's ~6 connections per host until reload
        if (stalled(e)) throw new SwarmApiError('The SwarmUI server did not respond.');
        throw e;
    }
    finally {
        if (timer) clearTimeout(timer);
    }
}

export async function newSession(): Promise<SessionInfo> {
    if (sessionPromise) {
        return sessionPromise;
    }
    sessionPromise = (async () => {
        let data = await postJson('GetNewSession', impersonating ? { impersonateUser: impersonating } : {});
        if (data.error_id === 'bad_impersonate') {
            console.warn(`Failed to impersonate user ${impersonating}, continuing as yourself.`);
            impersonating = null;
            data = await postJson('GetNewSession', {});
        }
        if (data.error) {
            throw new SwarmApiError(data.error, data.error_id, data);
        }
        session = data as SessionInfo;
        for (const cb of sessionListeners) {
            cb(session);
        }
        return session;
    })();
    try {
        return await sessionPromise;
    }
    finally {
        sessionPromise = null;
    }
}

async function ensureSession(): Promise<SessionInfo> {
    return session ?? newSession();
}

// coalesce overlapping identical reads; mutations and unique writes still go through
const DEDUPE = new Set([
    'ListImages', 'ListModels', 'ListLoadedModels', 'ListT2IParams',
    'GetCurrentStatus', 'GetUserSettings', 'GetMyUserData', 'GetAPIKeyStatus',
    'AhaGetSettings', 'AhaGetInstallFeatures',
    'ListBackends', 'ListBackendTypes', 'GetServerResourceInfo', 'ListConnectedUsers',
    'ListLogTypes', 'ListRecentLogMessages', 'CheckForUpdates', 'ComfyListTorchInstalls',
    'ComfyListWorkflows',
]);
const inflight = new Map<string, Promise<any>>();

export async function request<T = any>(route: string, body: Record<string, any> = {}, depth = 0): Promise<T> {
    const key = DEDUPE.has(route) ? `${route}:${JSON.stringify(body)}` : '';
    if (key && depth === 0) {
        const hit = inflight.get(key);
        if (hit) {
            return hit as Promise<T>;
        }
    }
    const run = requestOnce<T>(route, body, depth);
    if (key && depth === 0) {
        inflight.set(key, run);
        run.finally(() => { if (inflight.get(key) === run) inflight.delete(key); });
    }
    return run;
}

async function requestOnce<T = any>(route: string, body: Record<string, any> = {}, depth = 0): Promise<T> {
    const s = await ensureSession();
    const data = await postJson(route, { ...body, session_id: s.session_id });
    if (data?.error_id === 'invalid_session_id' && depth < 3) {
        if (session?.session_id === s.session_id) session = null;
        await ensureSession();
        return request<T>(route, body, depth + 1);
    }
    if (data?.error) {
        throw new SwarmApiError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error), data.error_id, data);
    }
    return data as T;
}

export interface WSHandle {
    socket: WebSocket;
    close: () => void;
    done: Promise<void>;
}

export function requestWS(route: string, body: Record<string, any>, onMessage: (data: any) => void, depth = 0): WSHandle {
    const wsRoot = swarmRoot.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsRoot}API/${route}`);
    let resolveDone!: () => void;
    let rejectDone!: (e: any) => void;
    const done = new Promise<void>((res, rej) => { resolveDone = res; rejectDone = rej; });
    let failed = false;
    let retried: WSHandle | null = null;
    let sentSession: string | null = null;
    // a socket stuck in CONNECTING never fires open, error, or close
    const connectTimer = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING && !failed) {
            failed = true;
            rejectDone(new SwarmApiError('The SwarmUI server did not respond.'));
            socket.close();
        }
    }, 20_000);
    socket.onopen = async () => {
        clearTimeout(connectTimer);
        if (failed) return;
        try {
            const s = await ensureSession();
            sentSession = s.session_id;
            socket.send(JSON.stringify({ ...body, session_id: s.session_id }));
        }
        catch (e) {
            failed = true;
            rejectDone(e);
            socket.close();
        }
    };
    socket.onmessage = async (ev) => {
        if (failed) return;
        let data: any;
        try {
            data = JSON.parse(ev.data);
        }
        catch {
            return;
        }
        if (failed) return;
        if (data.error_id === 'invalid_session_id' && depth < 3) {
            failed = true;
            socket.close();
            if (session?.session_id === sentSession) session = null;
            try {
                await ensureSession();
            }
            catch (e) {
                rejectDone(e);
                return;
            }
            retried = requestWS(route, body, onMessage, depth + 1);
            retried.done.then(resolveDone, rejectDone);
            return;
        }
        if (data.error) {
            failed = true;
            rejectDone(new SwarmApiError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error), data.error_id, data));
            return;
        }
        onMessage(data);
    };
    socket.onerror = () => {
        clearTimeout(connectTimer);
        if (!failed) {
            failed = true;
            rejectDone(new SwarmApiError('Connection to the SwarmUI server failed.'));
        }
    };
    socket.onclose = () => {
        clearTimeout(connectTimer);
        if (!failed && !retried) {
            resolveDone();
        }
    };
    return {
        socket,
        close: () => { clearTimeout(connectTimer); (retried as WSHandle | null)?.close(); socket.close(); },
        done,
    };
}
