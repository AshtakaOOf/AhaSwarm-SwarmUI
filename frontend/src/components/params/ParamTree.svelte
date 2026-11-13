<script lang="ts">
    import ParamTree from './ParamTree.svelte';
    import ParamInput from './ParamInput.svelte';
    import type { ParamInstallButton } from '../../lib/api/types';
    import { api } from '../../lib/api/swarm';
    import type { GroupNode } from '../../lib/state/params.svelte';
    import { paramState } from '../../lib/state/params.svelte';
    import { gen } from '../../lib/state/gen.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { ParamGroup, Button } from '../ui';
    import LDownload from '@lucide/svelte/icons/download';

    let { node, depth = 0 }: { node: GroupNode; depth?: number } = $props();
    const filtering = $derived(paramState.filter.trim().length > 0);
    const installButtons = $derived(node.group ? paramState.installButtonsFor(node.group.id) : []);

    async function installFeature(btn: ParamInstallButton) {
        const ids = btn.install_id.split(',').map(s => s.trim()).filter(Boolean);
        const features = ids.map(id => paramState.installFeatures[id]).filter(Boolean);
        if (features.length !== ids.length) {
            const missing = ids.filter(id => !paramState.installFeatures[id]);
            console.error(`Feature ID ${missing.join(', ')} not found in comfy_features, can't install`);
            return;
        }
        const names = features.map(f => f.display_name).join(', ');
        const notice = features.map(f => f.notice).join('\n').trim();
        if (!(await ui.ask(`Install ${names}?`, notice, { confirmLabel: 'Install', danger: false, size: 'md' }))) {
            return;
        }
        paramState.installStatus[btn.install_id] = 'installing';
        delete paramState.installError[btn.install_id];
        try {
            await api.comfyInstallFeatures(btn.install_id);
            paramState.installStatus[btn.install_id] = 'installed';
            ui.toast('Installed! Waiting for backends to restart.', 'info');
            gen.refreshStatus();
            // classic doFeatureInstaller removes the button after 8s
            setTimeout(() => {
                gen.refreshStatus();
                paramState.dismissInstall(btn.install_id);
            }, 8000);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            paramState.installStatus[btn.install_id] = 'error';
            paramState.installError[btn.install_id] = msg;
            ui.toast(msg || 'Failed to install feature.', 'error');
        }
    }
</script>

{#each node.params as p (p.id)}
    <ParamInput param={p} />
{/each}
{#each installButtons as btn (btn.install_id)}
    {@const st = paramState.installStatus[btn.install_id]}
    <div class="install-row">
        <Button icon={LDownload} disabled={st === 'installing' || st === 'installed'} onclick={() => { void installFeature(btn); }}>
            {st === 'installing' ? 'Installing…' : btn.label}
        </Button>
        {#if st === 'installed'}
            <p class="install-note">Installed. Please wait while backends restart. If it doesn't appear, restart Swarm.</p>
        {:else if st === 'error'}
            <p class="install-note err">{paramState.installError[btn.install_id] || 'Failed to install.'}</p>
        {/if}
    </div>
{/each}
{#each node.children as child (child.group!.id)}
    {@const g = child.group!}
    <ParamGroup title={g.id === 'resolution' && paramState.byId['width'] ? `${g.name}: ${paramState.resolutionLabel}` : g.name} description={g.description} id="grp-{g.id}"
        open={filtering || !!paramState.groupOpen[g.id]}
        ontoggle={(o: boolean) => { paramState.groupOpen[g.id] = o; }}
        toggleable={g.toggles}
        dim={child.params.length > 0 || child.children.length > 0}
        enabled={g.toggles ? !!paramState.groupToggles[g.id] : true}
        onenable={(e: boolean) => { paramState.groupToggles[g.id] = e; }}>
        <ParamTree node={child} depth={depth + 1} />
    </ParamGroup>
{/each}

<style>
    .install-row { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); padding: 2px 0; }
    .install-note { margin: 0; font-size: var(--text-small, 12px); color: var(--color-ink-2); }
    .install-note.err { color: var(--color-danger-text); }
</style>
