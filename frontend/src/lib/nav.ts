import LInfo from '@lucide/svelte/icons/info';
import LFileLock from '@lucide/svelte/icons/file-lock';
import LGitCompare from '@lucide/svelte/icons/git-compare-arrows';
import LDownload from '@lucide/svelte/icons/download';
import LActivity from '@lucide/svelte/icons/activity';
import LServer from '@lucide/svelte/icons/server';
import LUsers from '@lucide/svelte/icons/users';
import LPuzzle from '@lucide/svelte/icons/puzzle';
import LScroll from '@lucide/svelte/icons/scroll-text';
import LAppWindow from '@lucide/svelte/icons/app-window';
import LUserCog from '@lucide/svelte/icons/user-cog';
import LServerCog from '@lucide/svelte/icons/server-cog';
import type { LucideIcon } from '@lucide/svelte';
import { hasPermission } from './api/swarm';

// hash: the classic tab href where one exists, so classic links open the same tab
export type SubPage = { id: string; label: string; icon: LucideIcon; hash: string; perm?: string };
const ALL: Record<'utilities' | 'server' | 'settings', SubPage[]> = {
    utilities: [
        { id: 'info', label: 'Miscellaneous', icon: LInfo, hash: 'Utilities-Info-Tab' },
        { id: 'pickle', label: 'Pickle To Safetensors', icon: LFileLock, hash: 'Utilities-Pickle2Safetensor-Tab', perm: 'pickle2safetensors' },
        { id: 'lora', label: 'LoRA Extractor', icon: LGitCompare, hash: 'Utilities-LoraExtractor-Tab', perm: 'extra_loras' },
        { id: 'download', label: 'Model Downloader', icon: LDownload, hash: 'Utilities-ModelDownloader-Tab', perm: 'download_models' },
    ],
    server: [
        { id: 'info', label: 'Server Manager', icon: LActivity, hash: 'Server-Info' },
        { id: 'backends', label: 'Backends', icon: LServer, hash: 'Settings-Backends', perm: 'view_backends_list' },
        { id: 'users', label: 'Users', icon: LUsers, hash: 'Server-ManageUsers', perm: 'manage_users' },
        { id: 'extensions', label: 'Extensions', icon: LPuzzle, hash: 'Server-Extensions', perm: 'manage_extensions' },
        { id: 'logs', label: 'Logs', icon: LScroll, hash: 'Server-Logs', perm: 'view_logs' },
    ],
    settings: [
        { id: 'aha', label: 'AhaSwarm', icon: LAppWindow, hash: 'AhaSwarm-Settings' },
        { id: 'user', label: 'User Settings', icon: LUserCog, hash: 'Settings-User' },
        { id: 'server', label: 'Server Settings', icon: LServerCog, hash: 'Settings-Server', perm: 'read_server_settings' },
    ],
};
export function subPages(page: 'utilities' | 'server' | 'settings'): SubPage[] {
    return ALL[page].filter(p => !p.perm || hasPermission(p.perm));
}
export function subHash(page: keyof typeof ALL, id: string): string | undefined {
    return ALL[page].find(p => p.id === id)?.hash;
}
export function subFromHash(page: keyof typeof ALL, hash: string): string | undefined {
    if (page === 'utilities' && hash === 'Utilities-CLIP-Token-Tab') {
        return 'info';
    }
    return ALL[page].find(p => p.hash === hash)?.id;
}
