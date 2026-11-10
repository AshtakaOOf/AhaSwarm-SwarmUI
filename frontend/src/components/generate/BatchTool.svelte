<script lang="ts">
    import LFolder from '@lucide/svelte/icons/folder-input';
    import LImages from '@lucide/svelte/icons/images';
    import { api } from '../../lib/api/swarm';
    import { gen } from '../../lib/state/gen.svelte';
    import { toolState } from '../../lib/state/tools.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { Dropdown, FormRow, Section, TextInput, Toggle } from '../ui';

    const RES = ['From Parameter', 'From Image', 'Scale To Model', 'Scale To Model Or Above'].map(v => ({ value: v, label: v }));
    let inputFolder = $state('');
    let outputFolder = $state('');
    let initImage = $state(true);
    let controlnet = $state(true);
    let revision = $state(false);
    let appendName = $state(false);
    let resMode = $state('From Parameter');

    $effect(() => {
        toolState.setRunner(run);
        return () => toolState.setRunner(null);
    });

    function run() {
        try {
            if (inputFolder.trim().length < 5 || outputFolder.trim().length < 5) {
                throw new Error('Enter an input folder and an output folder.');
            }
            if (!initImage && !revision && !controlnet) {
                throw new Error('Use the images as at least one input.');
            }
            const base = gen.currentInput();
            gen.stream(base, (on) => api.imageBatchRun({
                baseParams: base,
                input_folder: inputFolder.trim(),
                output_folder: outputFolder.trim(),
                init_image: initImage,
                revision,
                controlnet,
                append_filename_to_prompt: appendName,
                resMode,
            }, on));
        }
        catch (e) {
            ui.error(e);
        }
    }
</script>

    <Section icon={LFolder} title="Folders">
        <p class="aha-muted">Runs every image in a server folder through the current parameters and writes the results to another folder. Run it with the Generate button.</p>
        <div class="aha-form ui-dense">
            <FormRow label="Input folder" info={'Folder path for input images.\nIt should contain only images (png, jpg, webp), not subfolders.'}><TextInput bind:value={inputFolder} aria-label="Input folder" placeholder="Folder of images" /></FormRow>
            <FormRow label="Output folder" info={'Folder path for image output.\nAn empty folder is recommended: existing files with the same names are overwritten.'}><TextInput bind:value={outputFolder} aria-label="Output folder" placeholder="Empty folder for results" /></FormRow>
            <FormRow label="Resolution" info={'From Parameter uses the Width/Height params. From Image keeps each image\'s size. Scale To Model fits the model\'s standard resolution; Or Above never shrinks.'}><Dropdown ariaLabel="Resolution" options={RES} bind:value={resMode} /></FormRow>
        </div>
    </Section>
    <Section icon={LImages} title="Use each image as">
        <div class="aha-form ui-dense">
            <FormRow label="Init image" info="Whether to use the image as the Init Image parameter."><Toggle hideLabel label="Use as init image" bind:checked={initImage} /></FormRow>
            <FormRow label="ControlNet input" info="Whether to use the image as input to ControlNet (only applies if a ControlNet model is enabled)."><Toggle hideLabel label="Use as ControlNet input" bind:checked={controlnet} /></FormRow>
            <FormRow label="Image prompt" info="Whether to use the image as an Image Prompting input."><Toggle hideLabel label="Use as image prompt" bind:checked={revision} /></FormRow>
            <FormRow label="Append filename" info="Whether to append the filename to the prompt."><Toggle hideLabel label="Append filename to prompt" bind:checked={appendName} /></FormRow>
        </div>
    </Section>
