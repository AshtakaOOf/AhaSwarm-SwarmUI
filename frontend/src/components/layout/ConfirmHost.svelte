<script lang="ts">
    import { ui } from '../../lib/state/ui.svelte';
    import { ConfirmDialog } from '../ui';
    function done(ok: boolean) {
        const r = ui.confirmReq;
        ui.confirmReq = null;
        r?.resolve(ok);
    }
</script>

{#if ui.confirmReq}
    {@const r = ui.confirmReq}
    {#key r}<ConfirmDialog title={r.title} message={r.message} confirmLabel={r.confirmLabel} danger={r.danger} size={r.size} onresult={done} />{/key}
{/if}
