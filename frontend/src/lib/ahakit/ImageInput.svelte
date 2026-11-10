<script lang="ts">
    import X from '@lucide/svelte/icons/x';
    import Upload from '@lucide/svelte/icons/upload';

    let { src, onfiles, onclear, label = 'Drop or choose an image' }: {
        src: string;
        onfiles: (files: File[]) => void;
        onclear: () => void;
        label?: string;
    } = $props();
    let input: HTMLInputElement | undefined = $state();
    let over = $state(false);
    let error = $state(false);
    let depth = 0;
    $effect(() => {
        void src;
        error = false;
    });

    function emit(list: FileList | null | undefined) {
        const files = Array.from(list ?? []).filter(f => f.type.startsWith('image/')).slice(0, 1);
        if (files.length) onfiles(files);
    }
    function drag(e: DragEvent, d: number) {
        if (!e.dataTransfer?.types.includes('Files')) return;
        e.preventDefault();
        depth = Math.max(0, depth + d);
        over = depth > 0;
    }
</script>

<div class="image-input" class:over class:filled={!!src && !error} role="button" tabindex="0" aria-label={label}
    onclick={() => input?.click()}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input?.click())}
    ondragenter={(e) => drag(e, 1)} ondragleave={(e) => drag(e, -1)} ondragover={(e) => drag(e, 0)}
    ondrop={(e) => { e.preventDefault(); depth = 0; over = false; emit(e.dataTransfer?.files); }}>
    {#if src && !error}
        <img {src} alt="Preview" onerror={() => (error = true)} />
        <span class="replace"><Upload size={16} aria-hidden="true" /> Replace</span>
        <button type="button" class="clear" aria-label="Clear image" title="Clear image"
            onclick={(e) => { e.stopPropagation(); onclear(); }}><X size={14} aria-hidden="true" /></button>
    {:else}
        <span class="placeholder"><Upload size={20} aria-hidden="true" /><span>{label}</span></span>
    {/if}
    <input bind:this={input} type="file" accept="image/*" hidden onchange={(e) => { emit(e.currentTarget.files); e.currentTarget.value = ''; }} />
</div>

<style>
    .image-input { position: relative; display: flex; align-items: center; justify-content: center; width: 120px; height: 120px; overflow: hidden; border-radius: var(--radius-ui); background: var(--color-input); color: var(--color-ink-3); cursor: pointer; transition: background-color 120ms, color 120ms; }
    .image-input:not(.filled) { border: 1px dashed var(--color-active); }
    .image-input:hover, .image-input.over { background: var(--color-input-hover); color: var(--color-ink); }
    .image-input img { width: 100%; height: 100%; object-fit: cover; }
    .replace { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: var(--color-backdrop); color: var(--color-ink); font-size: var(--text-small); opacity: 0; transition: opacity 120ms; }
    .image-input:hover .replace, .image-input.over .replace { opacity: 1; }
    .image-input:has(.clear:hover) .replace { opacity: 0; }
    .clear { position: absolute; top: 4px; right: 4px; z-index: 1; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 20px; padding: 0; border: 0; border-radius: var(--radius-sm); background: var(--color-float-btn); color: var(--color-ink); box-shadow: var(--shadow-float); cursor: pointer; }
    .clear:hover { background: var(--color-float-btn-hover); }
    .placeholder { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; font-size: var(--text-small); text-align: center; }
</style>
