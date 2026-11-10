
export interface ComfyBuilt {
    params: Record<string, any>;
    retained: string[];
    paramVal: Record<string, any>;
    promptJson: string;
    workflow: any;
}

export interface ComfyBuildInput {
    workflow: { nodes?: any[]; links?: any[] };
    prompt: Record<string, any>;
    objectInfo: Record<string, any>;
    serverParamIds: string[];
    models: string[];
    resetBatchSize: boolean;
    requireSave: boolean;
}

const ALT_SAVE = ['ADE_AnimateDiffCombine', 'VHS_VideoCombine', 'SaveAnimatedWEBP', 'SaveAnimatedPNG', 'SwarmSaveAnimatedWebpWS', 'SwarmSaveAnimationWS'];

const sub = (s: unknown, from: string, to: string) => `${s ?? ''}`.split(from).join(to);

function cleanParamName(name: string | null | undefined): string {
    return name == null ? '' : name.toLowerCase().replace(/[^a-z]/g, '');
}

function numberToLetters(id: number): string {
    if (id > 26) {
        return numberToLetters(Math.floor(id / 26)) + numberToLetters(id % 26);
    }
    return String.fromCharCode(id + 97);
}

function isLink(val: unknown): val is [string | number, number] {
    return Array.isArray(val) && val.length === 2 && (typeof val[0] === 'string' || typeof val[0] === 'number');
}

export function buildComfyParams(input: ComfyBuildInput): ComfyBuilt {
    const workflow = input.workflow ?? { nodes: [], links: [] };
    const prompt: Record<string, any> = JSON.parse(JSON.stringify(input.prompt ?? {}));
    const objectInfo = input.objectInfo ?? {};
    const serverIds = new Set(input.serverParamIds);
    const nodes: any[] = workflow.nodes ?? [];
    const links: any[] = workflow.links ?? [];

    const params: Record<string, any> = {};
    const inputPrefix = 'comfyrawworkflowinput';
    const idsUsed: string[] = [];
    const labelAlterations: Record<string, string> = {};
    const nodeStatics: Record<string, string> = {};
    const nodeIdToClean: Record<string, string> = {};
    const nodeStaticUnique: string[] = [];
    const nodeLabelPaths: Record<string, string> = {};
    const nodeIsRandomize: Record<string, boolean> = {};
    const claimedByPrimitives: string[] = [];
    let doAutoClaim = true;

    function getFreeIdStartingAt(start: number): number {
        let id = start;
        while (`${id}` in prompt) {
            id++;
        }
        return id;
    }

    function addSimpleParam(name: string, defVal: any, type: string, groupName: string, values: any, viewType: string, min: number, max: number, step: number, inputIdDirect: string, groupId: string, priority: number, visible = true, toggles = true): string {
        let inputId = inputIdDirect;
        let counter = 0;
        while (inputId in params) {
            inputId = `${inputIdDirect}${numberToLetters(counter++)}`;
        }
        const groupObj = groupId === 'primitives' ? null : {
            name: groupName, id: groupId, open: false, priority, advanced: groupId !== 'primitives', can_shrink: true, toggles: false,
        };
        params[inputId] = {
            name, default: defVal, id: inputId, type,
            description: `The ${name} input for ${groupName} (${type})`,
            values, view_type: viewType, min, max, step,
            visible, toggleable: toggles, priority, advanced: false, feature_flag: null,
            do_not_save: false, no_popover: true, group: groupObj,
        };
        return inputId;
    }

    for (const node of nodes) {
        if (node.title) {
            labelAlterations[`${node.id}`] = node.title;
        }
        const values = node.widgets_values;
        if (Array.isArray(values) && values.includes('randomize')) {
            nodeIsRandomize[`${node.id}`] = true;
        }
        if (typeof node.type === 'string' && node.type.startsWith('SwarmInput')) {
            doAutoClaim = false;
        }
        if (node.type === 'PrimitiveNode' && node.title) {
            const colon = node.title.indexOf(':');
            if (colon > 0 && node.title.substring(0, colon).trim().toLowerCase() === 'swarmui') {
                claimedByPrimitives.push(cleanParamName(node.title.substring(colon + 1)));
            }
            const cleanTitle = cleanParamName(node.title);
            let id = inputPrefix + cleanTitle;
            let x = 0;
            while (nodeStaticUnique.includes(node.title)) {
                id = `${inputPrefix}${cleanTitle}${numberToLetters(x++)}`;
            }
            nodeStaticUnique.push(id);
            for (const link of links) {
                if (link && link[1] === node.id) {
                    nodeStatics[`${link[3]}.${link[4]}`] = id;
                    nodeIdToClean[id] = node.title;
                }
            }
        }
    }
    for (const node of nodes) {
        if (!node.inputs) {
            continue;
        }
        let x = 0;
        for (const inp of node.inputs) {
            nodeLabelPaths[`${node.id}.${inp.name}`] = `${node.id}.${x++}`;
            if (`${node.id}` in labelAlterations) {
                labelAlterations[`${node.id}.${inp.name}`] = labelAlterations[`${node.id}`];
            }
        }
    }

    let hasSaves = false;
    let saveNodeId: string | null = null;
    let previewNodes: string[] = [];
    for (const nodeId of Object.keys(prompt)) {
        const node = prompt[nodeId];
        if (node.class_type === 'PreviewImage') {
            previewNodes.push(nodeId);
            continue;
        }
        if (node.class_type === 'SaveImage') {
            if ('SwarmSaveImageWS' in objectInfo && input.requireSave) {
                node.class_type = 'SwarmSaveImageWS';
                delete node.inputs?.filename_prefix;
            }
            saveNodeId = nodeId;
            hasSaves = true;
        }
        else if (node.class_type === 'SwarmSaveImageWS' || ALT_SAVE.includes(node.class_type)) {
            saveNodeId = nodeId;
            hasSaves = true;
        }
        if (node.inputs) {
            for (const inputId of Object.keys(node.inputs)) {
                const val = node.inputs[inputId];
                if (isLink(val) && val[1] === 0 && (inputId === 'negative' || inputId === 'positive')) {
                    labelAlterations[`${val[0]}`] = inputId === 'negative' ? 'Negative Prompt' : 'Positive Prompt';
                }
            }
        }
    }
    if (!hasSaves && previewNodes.length > 0 && input.requireSave) {
        prompt[previewNodes[0]].class_type = 'SwarmSaveImageWS';
        saveNodeId = previewNodes[0];
        hasSaves = true;
        previewNodes = previewNodes.slice(1);
    }
    if (hasSaves && saveNodeId != null && parseInt(saveNodeId) < 200 && input.requireSave) {
        const moved = getFreeIdStartingAt(200);
        prompt[moved] = prompt[saveNodeId];
        delete prompt[saveNodeId];
    }
    for (const preview of previewNodes) {
        delete prompt[preview];
    }
    let hasFixes = true;
    while (hasFixes) {
        hasFixes = false;
        for (const nodeId of Object.keys(prompt)) {
            const node = prompt[nodeId];
            if (node.class_type === 'unCLIPConditioning' && labelAlterations[nodeId]) {
                const inputCond = node.inputs?.conditioning;
                if (isLink(inputCond) && !labelAlterations[`${inputCond[0]}`]) {
                    labelAlterations[`${inputCond[0]}`] = labelAlterations[nodeId];
                    hasFixes = true;
                }
            }
        }
    }
    if (!hasSaves && input.requireSave) {
        throw new Error('ComfyUI workflow must have at least one Save Image node.');
    }

    const initialRetain = ['images', 'model', 'comfyuicustomworkflow'];
    const defaultParamsRetain = [...initialRetain];
    const defaultParamValue: Record<string, any> = {};
    const groups: string[] = [];

    function findConnection(target: string, pos: number): [string | null, string | null] {
        for (const nodeId of Object.keys(prompt)) {
            const node = prompt[nodeId];
            for (const inputId of Object.keys(node.inputs ?? {})) {
                const val = node.inputs[inputId];
                if (isLink(val) && `${val[0]}` === `${target}` && val[1] === pos) {
                    return [nodeId, inputId];
                }
            }
        }
        return [null, null];
    }

    for (const nodeId of Object.keys(prompt)) {
        const node = prompt[nodeId];
        if (!node.inputs) {
            node.inputs = {};
        }
        const groupLabel = `${labelAlterations[nodeId] || node.class_type} (Node ${nodeId})`;
        let groupId = cleanParamName(labelAlterations[nodeId] || node.class_type);
        if (groups.includes(groupId)) {
            groupId = `${groupId}${numberToLetters(parseInt(nodeId) || 0)}`;
        }
        groups.push(groupId);
        let priority = 0;
        if (groupLabel.includes('Prompt')) {
            priority = -10;
        }
        else if (groupLabel.includes('EmptyLatent')) {
            priority = -7;
        }
        else if (groupLabel.includes('KSampler')) {
            priority = -5;
        }

        if (typeof node.class_type === 'string' && node.class_type.startsWith('SwarmInput') && node.class_type !== 'SwarmInputGroup') {
            let type = 'text';
            let subtype: string | null = null;
            let defaultVal = node.inputs.value;
            let values: any = null;
            let doFixMe = false;
            switch (node.class_type) {
                case 'SwarmInputInteger': type = 'integer'; doFixMe = true; break;
                case 'SwarmInputFloat': type = 'decimal'; doFixMe = true; break;
                case 'SwarmInputText': type = 'text'; break;
                case 'SwarmInputModelName':
                    type = 'model';
                    subtype = node.inputs.subtype;
                    defaultVal = sub(sub(defaultVal, '\\', '/'), '.safetensors', '');
                    break;
                case 'SwarmInputCheckpoint':
                    type = 'model';
                    subtype = 'Stable-Diffusion';
                    defaultVal = sub(sub(defaultVal, '\\', '/'), '.safetensors', '');
                    break;
                case 'SwarmInputDropdown':
                    type = 'dropdown';
                    values = `${node.inputs.values ?? ''}`.split(',').map((s: string) => s.trim());
                    if (values.length <= 1) {
                        const [remoteNodeId, remoteInput] = findConnection(nodeId, 1);
                        if (remoteNodeId && remoteInput) {
                            const data = objectInfo[prompt[remoteNodeId].class_type];
                            const raw = data?.input?.required?.[remoteInput] ?? data?.input?.optional?.[remoteInput];
                            if (raw && raw.length > 1 && raw[0] === 'COMBO' && raw[1]?.options) {
                                values = raw[1].options;
                            }
                            else if (Array.isArray(raw)) {
                                values = raw[0];
                            }
                        }
                    }
                    break;
                case 'SwarmInputBoolean': type = 'boolean'; doFixMe = true; break;
                case 'SwarmInputImage': type = 'image'; break;
                case 'SwarmInputAudio': type = 'audio'; break;
                case 'SwarmInputVideo': type = 'video'; break;
                default: throw new Error(`Unknown SwarmInput type ${node.class_type}`);
            }
            const inputIdDirect = node.inputs.raw_id || cleanParamName(node.inputs.title);
            let inputId = inputIdDirect;
            let counter = 0;
            while (inputId in params) {
                inputId = `${inputIdDirect}${numberToLetters(counter++)}`;
            }
            let groupObj: any = { name: 'Ungrouped', id: 'ungrouped', open: true, priority: 0, advanced: false, toggles: false, can_shrink: false };
            if (isLink(node.inputs.group)) {
                const groupData = prompt[node.inputs.group[0]];
                groupObj = {
                    name: groupData.inputs.title,
                    id: cleanParamName(groupData.inputs.title),
                    open: groupData.inputs.open_by_default,
                    priority: groupData.inputs.order_priority,
                    advanced: groupData.inputs.is_advanced,
                    can_shrink: groupData.inputs.can_shrink,
                    toggles: false,
                };
            }
            params[inputId] = {
                name: node.inputs.title, id: inputId, type, subtype,
                description: node.inputs.description ?? '',
                default: defaultVal, values,
                view_type: node.inputs.view_type, min: node.inputs.min || 0, max: node.inputs.max || 0,
                view_max: node.inputs.view_max || 0, step: node.inputs.step || 0,
                visible: true, toggleable: false, priority: node.inputs.order_priority, advanced: node.inputs.is_advanced,
                feature_flag: null, do_not_save: false, no_popover: `${node.inputs.description ?? ''}`.length === 0, group: groupObj,
            };
            if (node.class_type === 'SwarmInputImage') {
                params[inputId].image_should_resize = node.inputs.auto_resize;
                params[inputId].image_always_b64 = true;
            }
            const safe = sub(sub(node.inputs.value, '${', '('), '}', ')');
            node.inputs.value = doFixMe ? `%%_COMFYFIXME_\${${inputId}:${safe}}_ENDFIXME_%%` : `\${${inputId}:${safe}}`;
        }

        function injectType(id: string, type: string): string {
            if (id.startsWith(inputPrefix)) {
                return inputPrefix + type + id.substring(inputPrefix.length);
            }
            return id;
        }

        function addParam(inputId: string, inputIdDirect: string, inputLabel: string, val: any, gId: string, gLabel: string, forceUniqueId: boolean): string | null {
            let paramDataRaw: any;
            const possible = objectInfo[node.class_type]?.input;
            if (possible?.required && inputId in possible.required) {
                paramDataRaw = possible.required[inputId];
            }
            let type = 'text';
            let values: any = null;
            let min = -9999999999;
            let max = 9999999999;
            let viewType = 'normal';
            let step = 1;
            let idDirect = inputIdDirect;
            if (typeof val === 'number') {
                let asSeed = false;
                if (inputId === 'seed' || inputId === 'noise_seed') {
                    type = 'integer';
                    viewType = 'seed';
                    asSeed = true;
                    if (nodeId in nodeIsRandomize || val < 0) {
                        val = -1;
                    }
                    else if (val > max) {
                        val = parseInt(`${val}`.substring(0, `${max}`.length - 1));
                    }
                }
                else if (inputId === 'width' || inputId === 'height') {
                    type = 'integer'; viewType = 'pot_slider'; min = 128; max = 8192; step = 64;
                }
                else if (inputId === 'denoise') {
                    type = 'decimal'; min = 0; max = 1; step = 0.05; viewType = 'slider';
                }
                else if (inputId === 'cfg') {
                    type = 'decimal'; min = 1; max = 50; step = 0.5;
                }
                else if (inputId === 'steps' || inputId === 'start_at_step' || inputId === 'end_at_step') {
                    type = 'integer'; min = 0; max = 10000; step = 1;
                }
                else if (paramDataRaw && paramDataRaw[0] === 'INT' && paramDataRaw.length === 2) {
                    type = 'integer'; viewType = 'big';
                    min = paramDataRaw[1].min ?? min;
                    max = paramDataRaw[1].max ?? max;
                    step = paramDataRaw[1].step ?? 1;
                    if (inputId === 'batch_size' && input.resetBatchSize && !claimedByPrimitives.includes('batchsize')) {
                        val = 1;
                    }
                }
                else if (paramDataRaw && paramDataRaw[0] === 'FLOAT' && paramDataRaw.length === 2) {
                    type = 'decimal'; viewType = 'slider';
                    min = paramDataRaw[1].min ?? min;
                    max = paramDataRaw[1].max ?? max;
                    step = paramDataRaw[1].step ?? ((max - min) * 0.01);
                }
                else {
                    type = 'decimal';
                }
                idDirect = injectType(idDirect, asSeed ? 'seed' : type);
                if (forceUniqueId) {
                    let count = 0;
                    while (idsUsed.includes(idDirect)) {
                        count++;
                        idDirect = `${idDirect}${numberToLetters(count)}`;
                    }
                }
                node.inputs[inputId] = `%%_COMFYFIXME_\${${idDirect}${asSeed ? '+seed' : ''}:${val}}_ENDFIXME_%%`;
            }
            else if (typeof val === 'string') {
                if (doAutoClaim && node.class_type === 'SaveImage' && inputId === 'filename_prefix') {
                    node.inputs[inputId] = '${prefix:}';
                    return null;
                }
                if (doAutoClaim && node.class_type === 'CheckpointLoaderSimple' && inputId === 'ckpt_name') {
                    if (!('model' in defaultParamValue) && !claimedByPrimitives.includes('model')) {
                        let model = node.inputs[inputId];
                        node.inputs[inputId] = `\${model:${sub(sub(model, '${', '('), '}', ')')}}`;
                        if (`${model}`.endsWith('.safetensors')) {
                            model = `${model}`.slice(0, -'.safetensors'.length);
                        }
                        defaultParamValue['model'] = sub(model, '\\', '/');
                        return null;
                    }
                    type = 'model';
                    values = input.models;
                }
                else if (node.class_type === 'KSamplerAdvanced' && (inputId === 'add_noise' || inputId === 'return_with_leftover_noise')) {
                    type = 'dropdown';
                    values = ['enable', 'disable'];
                }
                else if (node.class_type === 'SwarmLoadImageB64') {
                    type = 'image';
                }
                else if (paramDataRaw && paramDataRaw.length === 1 && paramDataRaw[0]?.length > 1) {
                    type = 'dropdown';
                    const fixArr = (arr: any[]) => arr.map(x => Array.isArray(x) ? x[0] : x);
                    values = fixArr(paramDataRaw[0]);
                }
                else {
                    viewType = 'prompt';
                    type = 'text';
                }
                idDirect = injectType(idDirect, type);
                if (forceUniqueId) {
                    let count = 0;
                    while (idsUsed.includes(idDirect)) {
                        count++;
                        idDirect = `${idDirect}${numberToLetters(count)}`;
                    }
                }
                node.inputs[inputId] = `\${${idDirect}:${sub(sub(val, '${', '('), '}', ')')}}`;
            }
            else {
                return null;
            }
            if (!idsUsed.includes(idDirect)) {
                idsUsed.push(idDirect);
                addSimpleParam(inputLabel, val, type, gLabel, values, viewType, min, max, step, idDirect, gId, gId === 'primitives' ? -200 : priority, true, true);
            }
            return idDirect;
        }

        function claimOnce(classType: string, paramName: string, fieldName: string, numeric: boolean): boolean {
            if (claimedByPrimitives.includes(cleanParamName(paramName)) || node.class_type !== classType) {
                return false;
            }
            let val = node.inputs[fieldName];
            if (typeof val !== (numeric ? 'number' : 'string')) {
                return false;
            }
            if (paramName === 'seed' && nodeId in nodeIsRandomize) {
                val = -1;
            }
            const redirId = nodeStatics[nodeLabelPaths[`${nodeId}.${fieldName}`]];
            const paramNameClean = cleanParamName(paramName);
            let actualId = paramName;
            let result = false;
            if (redirId) {
                let title = nodeIdToClean[redirId] || redirId.substring(inputPrefix.length);
                const colon = title.indexOf(':');
                if (colon > 0 && cleanParamName(title.substring(0, colon)) === 'swarmui') {
                    const reuseParam = cleanParamName(title.substring(colon + 1));
                    if (serverIds.has(reuseParam)) {
                        if (!defaultParamsRetain.includes(reuseParam)) {
                            defaultParamsRetain.push(reuseParam);
                            defaultParamValue[reuseParam] = val;
                        }
                        node.inputs[fieldName] = numeric
                            ? `%%_COMFYFIXME_\${${reuseParam}:${val}}_ENDFIXME_%%`
                            : `\${${reuseParam}:${sub(sub(val, '${', '('), '}', ')')}}`;
                        return true;
                    }
                }
                actualId = addParam(fieldName, redirId, title, val, 'primitives', 'Primitives', false) ?? redirId;
            }
            else if (defaultParamsRetain.includes(paramNameClean)) {
                return false;
            }
            else {
                defaultParamsRetain.push(paramNameClean);
                defaultParamValue[paramNameClean] = val;
                result = true;
            }
            node.inputs[fieldName] = numeric
                ? `%%_COMFYFIXME_\${${actualId}:${val}}_ENDFIXME_%%`
                : `\${${actualId}:${sub(sub(val, '${', '('), '}', ')')}}`;
            return result;
        }

        claimOnce('SwarmLoraLoader', 'loras', 'lora_names', false);
        claimOnce('SwarmLoraLoader', 'loraweights', 'lora_weights', false);
        if (doAutoClaim) {
            if (claimOnce('EmptyLatentImage', 'width', 'width', true) && claimOnce('EmptyLatentImage', 'height', 'height', true) && claimOnce('EmptyLatentImage', 'batchsize', 'batch_size', true)) {
                defaultParamsRetain.push('aspectratio', 'sidelength');
                defaultParamValue['aspectratio'] = 'Custom';
                continue;
            }
            claimOnce('KSampler', 'seed', 'seed', true);
            claimOnce('KSampler', 'steps', 'steps', true);
            claimOnce('KSampler', 'sampler', 'sampler_name', false);
            claimOnce('KSampler', 'scheduler', 'scheduler', false);
            claimOnce('KSampler', 'cfg_scale', 'cfg', true);
            claimOnce('KSamplerAdvanced', 'seed', 'noise_seed', true);
            claimOnce('KSamplerAdvanced', 'steps', 'steps', true);
            claimOnce('KSamplerAdvanced', 'sampler', 'sampler_name', false);
            claimOnce('KSamplerAdvanced', 'scheduler', 'scheduler', false);
            claimOnce('KSamplerAdvanced', 'cfg_scale', 'cfg', true);
            claimOnce('SwarmLoadImageB64', 'init_image', 'image_base64', false);
            claimOnce('LoadImage', 'initimage', 'image', false);
            if (node.class_type === 'CLIPTextEncode' && groupLabel.startsWith('Positive Prompt') && !defaultParamsRetain.includes('prompt') && typeof node.inputs.text === 'string') {
                defaultParamsRetain.push('prompt');
                defaultParamValue['prompt'] = node.inputs.text;
                node.inputs.text = '${prompt}';
                continue;
            }
            if (node.class_type === 'CLIPTextEncode' && groupLabel.startsWith('Negative Prompt') && !defaultParamsRetain.includes('negativeprompt') && typeof node.inputs.text === 'string') {
                defaultParamsRetain.push('negativeprompt');
                defaultParamValue['negativeprompt'] = node.inputs.text;
                node.inputs.text = '${negativeprompt}';
                continue;
            }
        }
        for (const inputId of Object.keys(node.inputs)) {
            if (inputId === 'choose file to upload' || inputId === 'image_upload') {
                continue;
            }
            const val = node.inputs[inputId];
            const shown = `${val ?? ''}`;
            if (shown.startsWith('${') || shown.startsWith('%%_COMFYFIXME_${')) {
                continue;
            }
            if ((node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') && inputId === 'control_after_generate') {
                continue;
            }
            if (`${node.class_type ?? ''}`.startsWith('SwarmInput')) {
                continue;
            }
            const redirId = nodeStatics[nodeLabelPaths[`${nodeId}.${inputId}`]];
            if (redirId) {
                const title = nodeIdToClean[redirId] || redirId.substring(inputPrefix.length);
                const colon = title.indexOf(':');
                if (colon > 0 && cleanParamName(title.substring(0, colon)) === 'swarmui') {
                    const reuseParam = cleanParamName(title.substring(colon + 1));
                    if (serverIds.has(reuseParam)) {
                        if (!defaultParamsRetain.includes(reuseParam)) {
                            defaultParamsRetain.push(reuseParam);
                            defaultParamValue[reuseParam] = val;
                        }
                        node.inputs[inputId] = typeof val !== 'string'
                            ? `%%_COMFYFIXME_\${${reuseParam}:${val}}_ENDFIXME_%%`
                            : `\${${reuseParam}:${sub(sub(val, '${', '('), '}', ')')}}`;
                        continue;
                    }
                }
                addParam(inputId, redirId, title, val, 'primitives', 'Primitives', false);
            }
            else {
                const inputLabel = labelAlterations[`${nodeId}.${inputId}`] || inputId;
                const inputIdDirect = cleanParamName(`${inputPrefix}${groupLabel}${inputId}${numberToLetters(parseInt(nodeId) || 0)}`);
                addParam(inputId, inputIdDirect, inputLabel, val, groupId, groupLabel, true);
            }
        }
    }

    addSimpleParam('comfyworkflowparammetadata', '', 'text', 'Comfy Workflow', null, 'big', 0, 1, 1, 'comfyworkflowparammetadata', 'comfyworkflow', -999999, false, false);
    addSimpleParam('comfyworkflowraw', '', 'text', 'Comfy Workflow', null, 'big', 0, 1, 1, 'comfyworkflowraw', 'comfyworkflow', -999999, false, false);
    params['comfyworkflowparammetadata'].extra_hidden = true;
    params['comfyworkflowraw'].extra_hidden = true;
    params['comfyworkflowparammetadata'].do_not_save = true;
    params['comfyworkflowraw'].do_not_save = true;
    params['comfyworkflowparammetadata'].default = JSON.stringify(params);
    params['comfyworkflowraw'].default = JSON.stringify(prompt);

    const retained: string[] = [];
    if (defaultParamValue['model']) {
        retained.push('model');
    }
    if (defaultParamsRetain.includes('width') && defaultParamsRetain.includes('height') && (!defaultParamsRetain.includes('aspectratio') || !defaultParamsRetain.includes('sidelength'))) {
        defaultParamsRetain.push('aspectratio', 'sidelength');
        defaultParamValue['aspectratio'] = 'Custom';
    }
    for (const param of defaultParamsRetain) {
        if (!initialRetain.includes(param) && param in defaultParamValue) {
            retained.push(param);
        }
    }
    return { params, retained, paramVal: defaultParamValue, promptJson: JSON.stringify(prompt), workflow };
}

function checkComfyParams(): void {
    const built = buildComfyParams({
        workflow: { nodes: [], links: [] },
        prompt: {
            '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'demo.safetensors' } },
            '6': { class_type: 'CLIPTextEncode', inputs: { text: 'a cat', clip: ['4', 1] } },
            '7': { class_type: 'CLIPTextEncode', inputs: { text: 'bad', clip: ['4', 1] } },
            '5': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 768, batch_size: 1 } },
            '3': { class_type: 'KSampler', inputs: { seed: 5, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
            '9': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
            '8': { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'SwarmUI' } },
        },
        objectInfo: { SwarmSaveImageWS: { output_node: true } },
        serverParamIds: ['prompt', 'negativeprompt', 'seed', 'steps', 'cfgscale', 'sampler', 'scheduler', 'width', 'height', 'batchsize', 'model', 'aspectratio', 'sidelength'],
        models: ['demo'],
        resetBatchSize: false,
        requireSave: true,
    });
    const raw = JSON.parse(built.promptJson);
    if (raw['6']?.inputs?.text !== '${prompt}' || built.paramVal['prompt'] !== 'a cat') {
        throw new Error('comfy prompt claim');
    }
    if (built.paramVal['model'] !== 'demo' || !built.retained.includes('seed') || built.paramVal['width'] !== 512) {
        throw new Error('comfy retain');
    }
    if (!(`${raw['8']?.class_type}` === 'SwarmSaveImageWS' || raw['200']?.class_type === 'SwarmSaveImageWS')) {
        throw new Error('comfy save node');
    }
    const swarm = buildComfyParams({
        workflow: { nodes: [{ id: 1, type: 'SwarmInputText' }], links: [] },
        prompt: {
            '1': { class_type: 'SwarmInputText', inputs: { title: 'Hello', value: 'hi', description: '', raw_id: 'hello', order_priority: 1, is_advanced: false, view_type: 'prompt', min: 0, max: 0, step: 0 } },
            '8': { class_type: 'SwarmSaveImageWS', inputs: { images: ['1', 0] } },
        },
        objectInfo: {},
        serverParamIds: [],
        models: [],
        resetBatchSize: false,
        requireSave: true,
    });
    if (swarm.params['hello']?.default !== 'hi' || !JSON.parse(swarm.promptJson)['1'].inputs.value.startsWith('${hello:')) {
        throw new Error('comfy swarm input');
    }
    let threw = false;
    try {
        buildComfyParams({ workflow: { nodes: [] }, prompt: { '1': { class_type: 'Note', inputs: {} } }, objectInfo: {}, serverParamIds: [], models: [], resetBatchSize: false, requireSave: true });
    }
    catch {
        threw = true;
    }
    if (!threw) {
        throw new Error('comfy save required');
    }
}
checkComfyParams();
