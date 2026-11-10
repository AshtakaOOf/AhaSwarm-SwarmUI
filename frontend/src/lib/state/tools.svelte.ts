import { hasPermission } from '../api/swarm';
import { paramState } from './params.svelte';
import { ui } from './ui.svelte';

export type ToolId = '' | 'grid' | 'batch' | 'comfy';

class ToolState {
    id = $state<ToolId>('');
    comfyFull = $state(false);
    private runner: (() => unknown) | null = null;

    available(): { id: Exclude<ToolId, ''>; label: string }[] {
        const out: { id: Exclude<ToolId, ''>; label: string }[] = [];
        if (hasPermission('gridgen_generate_grids')) out.push({ id: 'grid', label: 'Grid Generator' });
        if (hasPermission('imagebatcher_use_image_batcher')) out.push({ id: 'batch', label: 'Image Edit Batcher' });
        if (paramState.features.includes('comfyui') && (hasPermission('comfy_direct_calls') || hasPermission('comfy_read_workflows') || hasPermission('comfy_edit_workflows'))) {
            out.push({ id: 'comfy', label: 'Comfy Workflow' });
        }
        return out;
    }

    get runnable(): 'grid' | 'batch' | null {
        return ui.bottomTab === 'tools' && (this.id === 'grid' || this.id === 'batch') ? this.id : null;
    }

    toggleComfyFull(): void {
        if (this.comfyFull) {
            this.comfyFull = false;
            return;
        }
        ui.go('generate');
        ui.showBottom('tools');
        this.id = 'comfy';
        this.comfyFull = true;
    }

    setRunner(fn: (() => unknown) | null): void {
        this.runner = fn;
    }

    run(): unknown {
        return this.runner?.();
    }
}

export const toolState = new ToolState();
