import { request, requestWS, getSessionInfo } from './client';
import type {
    ListT2IParamsResponse, CurrentStatus, ListModelsResponse, ListImagesResponse, UserData,
    BackendInfo, GenWSMessage,
} from './types';

export const api = {
    listT2IParams: () => request<ListT2IParamsResponse>('ListT2IParams'),
    getCurrentStatus: () => request<CurrentStatus>('GetCurrentStatus'),
    interruptAll: (otherSessions = false) => request('InterruptAll', { other_sessions: otherSessions }),
    listModels: (subtype = 'Stable-Diffusion', path = '', depth = 6, sortBy = 'Name', sortReverse = false) =>
        request<ListModelsResponse>('ListModels', { path, depth, subtype, sortBy, sortReverse, allowRemote: true }),
    describeModel: (modelName: string, subtype = 'Stable-Diffusion') =>
        request<{ model: any }>('DescribeModel', { modelName, subtype }),
    listLoadedModels: () => request<{ models: any[] }>('ListLoadedModels'),
    selectModel: (model: string) => request('SelectModel', { model }),
    listImages: (path = '', depth = 1, sortBy = 'Date', sortReverse = false, filter: string | null = null) =>
        request<ListImagesResponse>('ListImages', { path, depth, sortBy, sortReverse, ...(filter ? { filter } : {}) }),
    openImageFolder: (path: string) => request('OpenImageFolder', { path }),
    deleteImage: (path: string) => request('DeleteImage', { path }),
    toggleImageStarred: (path: string) => request<{ new_state: boolean }>('ToggleImageStarred', { path }),
    countTokens: (text: string) => request<{ count: number }>('CountTokens', { text, skipPromptSyntax: true }),
    setStarredModels: (starred: Record<string, string[]>) => request('SetStarredModels', starred),
    setPresetLinks: (links: Record<string, any>) => request('SetPresetLinks', links),
    setParamEdits: (edits: any) => request('SetParamEdits', { edits }),
    getMyUserData: () => request<UserData>('GetMyUserData'),
    ahaGetSettings: () => request<{ settings: Record<string, unknown> | null }>('AhaGetSettings'),
    ahaSaveSettings: (settings: Record<string, unknown>) => request('AhaSaveSettings', { settings: JSON.stringify(settings) }),
    addNewPreset: (title: string, description: string, paramMap: Record<string, any>, opts: { previewImage?: string; isEdit?: boolean; editing?: string; isStarred?: boolean } = {}) =>
        request<{ success?: boolean; preset_fail?: string }>('AddNewPreset', {
            title, description, param_map: paramMap,
            ...(opts.previewImage ? { preview_image: opts.previewImage } : {}),
            is_edit: !!opts.isEdit, ...(opts.editing ? { editing: opts.editing } : {}), is_starred: !!opts.isStarred,
        }),
    deletePreset: (preset: string) => request('DeletePreset', { preset }),
    getUserSettings: () => request<{ themes: Record<string, any>; settings: Record<string, any> }>('GetUserSettings'),
    listBackends: () => request<Record<string, BackendInfo>>('ListBackends', { full_data: true }),
    toggleBackend: (backend_id: number | string, enabled: boolean) => request('ToggleBackend', { backend_id: Number(backend_id), enabled }),
    restartBackends: (backend: string = 'all') => request('RestartBackends', { backend }),
    freeBackendMemory: (system_ram = false, backend = 'all') => request('FreeBackendMemory', { system_ram, backend }),
    getServerResourceInfo: () => request<any>('GetServerResourceInfo'),
    listRecentLogMessages: (types = ['Info', 'Init', 'Warning', 'Error'], lastSequenceIds: Record<string, number> = {}) =>
        request<any>('ListRecentLogMessages', { types, last_sequence_ids: lastSequenceIds }),
    triggerRefresh: (strong = true) => request('TriggerRefresh', { strong }),
    listServerSettings: () => request<{ settings: Record<string, any> }>('ListServerSettings'),
    changeServerSettings: (settings: Record<string, any>) => request('ChangeServerSettings', { settings }),
    changeUserSettings: (settings: Record<string, any>) => request('ChangeUserSettings', { settings }),
    listConnectedUsers: () => request<{ users: any[] }>('ListConnectedUsers'),
    checkForUpdates: () => request<any>('CheckForUpdates'),
    updateAndRestart: (opts: Record<string, any> = { force: true }) => request<any>('UpdateAndRestart', opts),
    shutdownServer: () => request('ShutdownServer'),
    listBackendTypes: () => request<{ list: any[] }>('ListBackendTypes'),
    comfyListTorchInstalls: () => request<{ target_torch_version: string; installs: { path: string; torch_version: string; can_update: boolean; backend_ids: number[] }[] }>('ComfyListTorchInstalls'),
    addNewBackend: (type_id: string) => request<any>('AddNewBackend', { type_id }),
    deleteBackend: (backend_id: number | string) => request('DeleteBackend', { backend_id: Number(backend_id) }),
    editBackend: (backend_id: number | string, title: string, settings: Record<string, any>) => request('EditBackend', { backend_id: Number(backend_id), title, settings }),
    listLogTypes: () => request<{ types_available: { name: string; color: string }[] }>('ListLogTypes'),
    adminListUsers: () => request<{ users: string[] }>('AdminListUsers'),
    adminGetUserInfo: (name: string) => request<any>('AdminGetUserInfo', { name }),
    adminAddUser: (name: string, password: string, role: string) => request('AdminAddUser', { name, password, role }),
    adminDeleteUser: (name: string) => request('AdminDeleteUser', { name }),
    adminListRoles: () => request<{ roles: Record<string, any> }>('AdminListRoles'),
    installExtension: (extensionName: string) => request('InstallExtension', { extensionName }),
    setExtensionEnabled: (extensionName: string, enabled: boolean) => request('SetExtensionEnabled', { extensionName, enabled }),
    updateExtension: (extensionName: string) => request('UpdateExtension', { extensionName }),
    uninstallExtension: (extensionName: string) => request('UninstallExtension', { extensionName }),
    tokenizeInDetail: (text: string, tokenset = 'clip') => request<{ tokens: { id: number; weight: number; text: string }[] }>('TokenizeInDetail', { text, skipPromptSyntax: true, tokenset }),
    pickle2SafeTensor: (type: string, fp16: boolean) => request('Pickle2SafeTensor', { type, fp16 }),
    wipeMetadata: (type: 'image' | 'model' | 'all') => request('WipeMetadata', { type }),
    forwardMetadataRequest: (url: string) => request<{ response?: any; error?: string }>('ForwardMetadataRequest', { url }),
    forwardImageRequest: (url: string) => request<{ image?: string; error?: string }>('ForwardImageRequest', { url }),
    getModelHash: (modelName: string, subtype: string) => request<{ hash: string }>('GetModelHash', { modelName, subtype }),
    editModelMetadata: (data: Record<string, any>) => request('EditModelMetadata', data),
    deleteModel: (modelName: string, subtype: string) => request('DeleteModel', { modelName, subtype }),
    renameModel: (oldName: string, newName: string, subtype: string) => request('RenameModel', { oldName, newName, subtype }),
    getModelHeaders: (model: string, subtype: string) => request<{ headers: Record<string, any> }>('GetModelHeaders', { model, subtype }),
    loraExtractionWS: (input: { baseModel: string; otherModel: string; rank: number; outName: string }, onMessage: (m: any) => void) => requestWS('DoLoraExtractionWS', input, onMessage),
    modelDownloadWS: (input: { url: string; type: string; name: string; metadata?: string }, onMessage: (m: any) => void) => requestWS('DoModelDownloadWS', input, onMessage),
    // user menu (classic usertab.js): upstream API keys (status only, values are never returned) and logout
    getAPIKeyStatus: (keyType: string) => request<{ status: string }>('GetAPIKeyStatus', { keyType }),
    setAPIKey: (keyType: string, key: string) => request('SetAPIKey', { keyType, key }),
    logout: () => request('Logout'),
    comfyListWorkflows: () => request<{ workflows: { name: string; image?: string; description?: string; enable_in_simple?: boolean }[] }>('ComfyListWorkflows'),
    comfyReadWorkflow: (name: string) => request<{ result: { workflow: string; prompt: string; custom_params: string; param_values?: string; image?: string; description?: string } }>('ComfyReadWorkflow', { name }),
    comfySaveWorkflow: (body: Record<string, any>) => request('ComfySaveWorkflow', body),
    comfyDeleteWorkflow: (name: string) => request('ComfyDeleteWorkflow', { name }),
    comfyGetGeneratedWorkflow: (rawInput: Record<string, any>) => request<{ workflow?: string }>('ComfyGetGeneratedWorkflow', rawInput),
    editWildcard: (card: string, options: string, previewImage?: string) =>
        request('EditWildcard', { card, options, ...(previewImage != null ? { preview_image: previewImage } : {}) }),
    deleteWildcard: (card: string) => request('DeleteWildcard', { card }),
    testPromptFill: (prompt: string) => request<{ result: string }>('TestPromptFill', { prompt }),
    gridGenRun: (body: Record<string, any>, onMessage: (m: GenWSMessage) => void) =>
        requestWS('GridGenRun', body, (m: any) => onMessage(normalizeGenMessage(m))),
    gridGenDoesExist: (folderName: string) => request<{ exists: boolean }>('GridGenDoesExist', { folderName }),
    gridGenListData: () => request<{ data?: string[]; history?: string[] }>('GridGenListData'),
    gridGenGetData: (gridName: string) => request<{ data: any }>('GridGenGetData', { gridName }),
    gridGenSaveData: (gridName: string, isPublic: boolean, data: any) => request('GridGenSaveData', { gridName, isPublic, data }),
    gridGenDeleteData: (gridName: string) => request('GridGenDeleteData', { gridName }),
    imageBatchRun: (body: Record<string, any>, onMessage: (m: GenWSMessage) => void) =>
        requestWS('ImageBatchRun', body, (m: any) => onMessage(normalizeGenMessage(m))),
    generateWS: (input: Record<string, any>, onMessage: (m: GenWSMessage) => void) =>
        requestWS('GenerateText2ImageWS', input, (m: any) => onMessage(normalizeGenMessage(m))),
};

export function normalizeGenMessage(m: any): GenWSMessage {
    if (typeof m?.image === 'string') {
        const { image, batch_index, request_id, metadata, ...rest } = m;
        return { ...rest, image: { image, batch_index: `${batch_index ?? 0}`, request_id, metadata: metadata ?? null } };
    }
    return m;
}

export function outputPrefix(): string {
    const s = getSessionInfo();
    if (!s) {
        return 'Output';
    }
    return s.output_append_user ? `View/${s.user_id}` : 'Output';
}

export function hasPermission(perm: string): boolean {
    const p = getSessionInfo()?.permissions;
    return !!p && (p.includes(perm) || p.includes('*'));
}
