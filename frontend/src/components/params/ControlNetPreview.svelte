<script lang="ts">
    import LEye from '@lucide/svelte/icons/eye';
    import LSave from '@lucide/svelte/icons/save';
    import { api } from '../../lib/api/swarm';
    import { resolveUrl } from '../../lib/api/client';
    import { paramState } from '../../lib/state/params.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { Button } from '../ui';

    let src = $state('');
    let note = $state('');
    let saved = $state('');
    let saveTimer = 0;
    const video = $derived(/^(data:video\/)|\.(mp4|webm|mov|mpeg)(\?|$)/i.test(src));
    const shown = $derived.by(() => {
        const p = paramState.byId['controlnetimageinput'];
        return !!p && paramState.isSupported(p);
    });

    function hasImage(id: string): boolean {
        const v = paramState.values[id];
        if (v == null || v === '') {
            return false;
        }
        return typeof v === 'object' ? !!v.data : true;
    }

    // classic controlnetShowPreview
    async function preview() {
        paramState.groupToggles['controlnet'] = true;
        const input = paramState.buildInput({
            images: 1,
            prompt: '',
            batchsize: null,
            donotsave: true,
            controlnetpreviewonly: true,
        });
        if (presetState.current.length) {
            input['presets'] = [...presetState.current];
        }
        if (!input['model']) {
            throw new Error('Pick a model first (Models tab or the model selector).');
        }
        src = '';
        saved = '';
        note = '';
        if (!hasImage('controlnetimageinput') && !hasImage('initimage')) {
            note = 'Must select an image.';
            return;
        }
        let got = '';
        const handle = api.generateWS(input, (m) => {
            if (m.image?.image) {
                got = m.image.image;
            }
        });
        await handle.done;
        if (!got) {
            note = 'No preview was returned.';
            return;
        }
        src = got;
    }

    // classic controlnetSavePreviewToServer
    async function save() {
        if (!src) {
            return;
        }
        const d = new Date();
        const p = (n: number) => `${n}`.padStart(2, '0');
        const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
        await api.addImageToHistory({ image: src, 'Override Outpath Format': `inputs/controlnet/controlnet-preview-${stamp}` });
        saved = 'Saved ControlNet preview.';
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => (saved = ''), 5000);
    }
</script>

{#if shown}
    <div class="cn">
        <div class="row">
            <Button icon={LEye} onclick={preview}>Preview</Button>
            {#if src}<Button icon={LSave} onclick={save}>Save to Server</Button>{/if}
        </div>
        {#if note}<p class="note">{note}</p>{/if}
        {#if saved}<p class="note">{saved}</p>{/if}
        {#if src}
            {#if video}
                <video src={resolveUrl(src)} loop muted autoplay controls playsinline></video>
            {:else}
                <img src={resolveUrl(src)} alt="ControlNet preview" />
            {/if}
        {/if}
    </div>
{/if}

<style>
    .cn { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); padding: 2px 0; }
    .row { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .note { margin: 0; font-size: var(--text-small, 12px); color: var(--color-ink-2); }
    img, video { max-width: 200px; max-height: 200px; border-radius: var(--radius-ui); }
</style>
