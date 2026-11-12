import type { SessionInfo } from './types';

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

export function getSessionInfo(): SessionInfo | null {
    return session;
}

export function onSession(cb: (s: SessionInfo) => void): void {
    sessionListeners.push(cb);
    if (session) {
        cb(session);
    }
}

async function postJson(route: string, body: any): Promise<any> {
    const res = await fetch(`${swarmRoot}API/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });
    let data: any = null;
    try {
        data = await res.json();
    }
    catch {
        throw new SwarmApiError(`Server returned ${res.status} for ${route}`);
    }
    return data;
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
            if (data.error_id === 'needs_login' || /login/i.test(data.error)) {
                location.href = `${swarmRoot}Login`;
            }
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

export async function request<T = any>(route: string, body: Record<string, any> = {}, depth = 0): Promise<T> {
    const s = await ensureSession();
    const data = await postJson(route, { ...body, session_id: s.session_id });
    if (data?.error_id === 'invalid_session_id' && depth < 3) {
        session = null;
        await newSession();
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
    socket.onopen = async () => {
        try {
            const s = await ensureSession();
            socket.send(JSON.stringify({ ...body, session_id: s.session_id }));
        }
        catch (e) {
            failed = true;
            rejectDone(e);
            socket.close();
        }
    };
    socket.onmessage = async (ev) => {
        let data: any;
        try {
            data = JSON.parse(ev.data);
        }
        catch {
            return;
        }
        if (data.error_id === 'invalid_session_id' && depth < 3) {
            failed = true;
            socket.close();
            session = null;
            await newSession();
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
        if (!failed) {
            failed = true;
            rejectDone(new SwarmApiError('Connection to the SwarmUI server failed.'));
        }
    };
    socket.onclose = () => {
        if (!failed && !retried) {
            resolveDone();
        }
    };
    return {
        socket,
        close: () => { (retried as WSHandle | null)?.close(); socket.close(); },
        done,
    };
}
