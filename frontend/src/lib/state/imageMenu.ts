import LCopy from '@lucide/svelte/icons/copy';
import LDownload from '@lucide/svelte/icons/download';
import LExternalLink from '@lucide/svelte/icons/external-link';
import LFolder from '@lucide/svelte/icons/folder';
import LImage from '@lucide/svelte/icons/image';
import LStar from '@lucide/svelte/icons/star';
import LTrash2 from '@lucide/svelte/icons/trash-2';
import { resolveUrl } from '../api/client';
import { hasPermission } from '../api/swarm';
import { fileName, mediaType, parseMetadata } from '../util/metadata';
import { copyText, type MenuItem } from '$ahakit';
import { confirmAndDelete, historyPath, openInFolder, refineImage, reuseParams, toggleStar, upscale2x, useAsImagePrompt, useAsInit, viewInHistory } from './actions';

export interface ImageRef { src: string; metadata: string | null }

export function downloadImage(src: string): void {
    const a = document.createElement('a');
    a.href = resolveUrl(src);
    a.download = fileName(src) || 'image';
    a.click();
}

export function imageMoreItems(c: ImageRef): MenuItem[] {
    const kind = mediaType(c.src);
    const isData = c.src.startsWith('data:');
    const items: MenuItem[] = [];
    if (kind === 'image') {
        items.push({ label: 'Use As Image Prompt', icon: LImage, title: 'Uses this image as an Image Prompt input', onselect: () => useAsImagePrompt(c.src) });
        items.push({ label: 'Edit Image', disabled: true, title: 'The image editor is not available in AhaSwarm yet' });
    }
    if (kind !== 'audio') {
        items.push({ label: 'Upscale 2x', title: 'Runs an instant generation with this image as the input and scale doubled', onselect: () => upscale2x(c.src) });
    }
    if (kind === 'image') {
        items.push({ label: 'Refine Image', title: 'Runs an instant generation with Refine / Upscale turned on', onselect: () => refineImage(c.src, c.metadata) });
    }
    if (!isData) {
        items.push({ label: 'View In History', icon: LFolder, title: 'Jumps the History browser to where this file is at.', onselect: () => viewInHistory(c.src) });
    }
    items.push({ separator: true });
    if (c.metadata) {
        items.push({ label: 'Copy Raw Metadata', icon: LCopy, title: "Copies the raw form of the image's metadata to your clipboard (usually JSON text).", onselect: () => copyText(c.metadata!) });
    }
    if (!isData) {
        items.push({ label: 'Copy Path', title: 'Copies the relative file path of this image to your clipboard.', onselect: () => copyText(historyPath(c.src) ?? c.src) });
        if (hasPermission('local_image_folder')) {
            items.push({ label: 'Open In Folder', icon: LFolder, title: 'Opens the folder containing this image in your local PC file explorer.', onselect: () => openInFolder(c.src) });
        }
    }
    items.push({ label: 'Download', icon: LDownload, title: 'Downloads this image to your PC.', onselect: () => downloadImage(c.src) });
    items.push({ label: 'Open In New Tab', icon: LExternalLink, onselect: () => window.open(resolveUrl(c.src), '_blank', 'noopener') });
    if (!isData) {
        items.push({ separator: true });
        items.push({ label: 'Delete', icon: LTrash2, danger: true, title: 'Deletes this image from the server.', onselect: () => confirmAndDelete(c.src) });
    }
    return items;
}

export function imageMenuItems(c: ImageRef, starred = !!parseMetadata(c.metadata)?.raw?.is_starred): MenuItem[] {
    const kind = mediaType(c.src);
    const main: MenuItem[] = [];
    if (kind === 'image' || kind === 'video') {
        main.push({ label: 'Use As Init', onselect: () => useAsInit(c.src) });
    }
    if (!c.src.startsWith('data:')) {
        main.push({ label: starred ? 'Unstar' : 'Star', icon: LStar, fill: starred ? 'currentColor' : undefined, onselect: () => toggleStar(c.src) });
    }
    main.push({ label: 'Reuse Parameters', onselect: () => reuseParams(c.metadata) });
    return [...main, { separator: true }, ...imageMoreItems(c)];
}
