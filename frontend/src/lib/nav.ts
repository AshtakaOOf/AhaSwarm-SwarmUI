import LInfo from '@lucide/svelte/icons/info';
import LWholeWord from '@lucide/svelte/icons/whole-word';
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

export type SubPage = { id: string; label: string; icon: LucideIcon; perm?: string };
const ALL: Record<'utilities' | 'server' | 'settings', SubPage[]> = {
    utilities: [
        { id: 'info', label: 'Info', icon: LInfo },
        { id: 'clip', label: 'CLIP Tokenization', icon: LWholeWord, perm: 'use_tokenizer' },
        { id: 'pickle', label: 'Pickle To Safetensors', icon: LFileLock, perm: 'pickle2safetensors' },
        { id: 'lora', label: 'LoRA Extractor', icon: LGitCompare, perm: 'extra_loras' },
        { id: 'download', label: 'Model Downloader', icon: LDownload, perm: 'download_models' },
    ],
    server: [
        { id: 'info', label: 'Server Manager', icon: LActivity },
        { id: 'backends', label: 'Backends', icon: LServer, perm: 'view_backends_list' },
        { id: 'users', label: 'Users', icon: LUsers, perm: 'manage_users' },
        { id: 'extensions', label: 'Extensions', icon: LPuzzle, perm: 'manage_extensions' },
        { id: 'logs', label: 'Logs', icon: LScroll, perm: 'view_logs' },
    ],
    settings: [
        { id: 'aha', label: 'AhaSwarm', icon: LAppWindow },
        { id: 'user', label: 'User Settings', icon: LUserCog },
        { id: 'server', label: 'Server Settings', icon: LServerCog, perm: 'read_server_settings' },
    ],
};
export function subPages(page: 'utilities' | 'server' | 'settings'): SubPage[] {
    return ALL[page].filter(p => !p.perm || hasPermission(p.perm));
}
