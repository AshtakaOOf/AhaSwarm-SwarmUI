import { Editor } from '../editor/editor.svelte';
import { resolveUrl } from '../api/client';
import { api } from '../api/swarm';
import { gen } from './gen.svelte';
import { paramState } from './params.svelte';
import { ui } from './ui.svelte';

const MANAGED = ['initimage', 'maskimage'];

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not load that image into the editor.'));
        img.src = src.startsWith('data:') ? src : resolveUrl(src);
    });
}

/**
 * classic imageEditor. The edit (`editor`) outlives the modal: closing the modal keeps it, and while it exists every
 * generation uses its picture as the init image and its mask layers as the mask, until it's discarded.
 */
class EditorState {
    editor = $state.raw<Editor | null>(null);
    /** whether the editor modal is showing */
    visible = $state(false);

    get active(): boolean {
        return !!this.editor;
    }

    private start(make: (ed: Editor) => void, w: number, h: number): void {
        this.editor?.destroy();
        const ed = new Editor();
        ed.onNotice = (msg) => ui.toast(msg, 'info');
        make(ed);
        this.editor = ed;
        this.visible = true;
        paramState.managedParams = MANAGED;
        // classic "Edit Image": the generation size follows the picture
        if (paramState.byId['aspectratio']) {
            paramState.values['aspectratio'] = 'Custom';
        }
        if (paramState.byId['width'] && paramState.byId['height']) {
            paramState.values['width'] = w;
            paramState.values['height'] = h;
        }
        ui.go('generate');
    }

    /** asks before a new edit replaces one with changes */
    private async mayReplace(): Promise<boolean> {
        return !this.editor?.canUndo || ui.ask('Start a new edit?', 'Your current image edit will be discarded.', { confirmLabel: 'Discard and continue' });
    }

    /** classic currentimagehandler "Edit Image" */
    async open(src: string): Promise<void> {
        if (!(await this.mayReplace())) {
            return;
        }
        try {
            const img = await loadImage(src);
            this.start(ed => ed.load(img, img.naturalWidth, img.naturalHeight), img.naturalWidth, img.naturalHeight);
        }
        catch (e) {
            ui.error(e);
        }
    }

    /** classic openEmptyEditor: a white canvas at the current width x height */
    async openBlank(): Promise<void> {
        if (!(await this.mayReplace())) {
            return;
        }
        const w = Math.max(64, Number(paramState.values['width']) || 1024), h = Math.max(64, Number(paramState.values['height']) || 1024);
        this.start(ed => ed.blank(w, h), w, h);
    }

    async addLayerFrom(src: string): Promise<void> {
        try {
            const img = await loadImage(src);
            this.editor?.addImageLayer(img, 'Result');
        }
        catch (e) {
            ui.error(e);
        }
    }

    download(): void {
        const ed = this.editor;
        if (!ed) {
            return;
        }
        const a = document.createElement('a');
        a.href = ed.finalImage();
        const d = new Date(), pad = (n: number) => `${n}`.padStart(2, '0');
        a.download = `edited-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
        a.click();
    }

    /** classic storeImageToHistoryWithCurrentParams: saves with the current params as its metadata */
    async saveToHistory(full = false): Promise<void> {
        const ed = this.editor;
        if (!ed) {
            return;
        }
        const input = gen.currentInput();
        delete input['initimage'];
        delete input['maskimage'];
        input['image'] = full ? ed.fullCanvasImage() : ed.finalImage();
        const res = await api.addImageToHistory(input);
        const out = res.images?.[0];
        if (out?.image) {
            gen.addOutput(out.image, out.metadata);
        }
        ui.toast('Saved to Image History.', 'success');
    }

    /** the Image Editor button: back to the current edit, else edit the current image, else a blank canvas */
    show(): void {
        if (this.editor) {
            this.visible = true;
            return;
        }
        const cur = gen.current;
        if (cur && !/\.(mp4|webm|mov|gif|mp3|wav|ogg|flac)(\?|$)/i.test(cur.src) && !cur.src.includes('model_placeholder')) {
            this.open(cur.src);
        }
        else {
            this.openBlank();
        }
    }

    /** closes the modal but keeps the edit (generations keep using it) */
    hide(): void {
        this.visible = false;
    }

    async discard(): Promise<void> {
        if (this.editor?.canUndo && !(await ui.ask('Discard the image edit?', 'Generations will stop using it, and your edits will be lost.', { confirmLabel: 'Discard' }))) {
            return;
        }
        this.close();
    }

    close(): void {
        this.visible = false;
        this.editor?.destroy();
        this.editor = null;
        paramState.managedParams = [];
    }
}

export const editorState = new EditorState();

// classic getGenInput, imageEditor.active branch
paramState.inputHooks.push((input, extra) => {
    const ed = editorState.editor;
    if (!ed || !ed.width) {
        return;
    }
    const { image, mask } = ed.exportForGen();
    extra['used_image_editor'] = 'true';
    input['initimage'] = image;
    input['maskimage'] = mask;
    input['width'] = Math.floor(ed.width / 8) * 8;
    input['height'] = Math.floor(ed.height / 8) * 8;
    input['aspectratio'] = 'Custom';
    delete input['sidelength'];
    if (!input['initimagecreativity']) {
        input['initimagecreativity'] = paramState.values['initimagecreativity'] ?? 0.6;
    }
});
