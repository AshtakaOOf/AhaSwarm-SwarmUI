
export type ParamType =
    | 'text' | 'integer' | 'decimal' | 'boolean' | 'dropdown' | 'list' | 'model'
    | 'image' | 'image_list' | 'audio' | 'audio_list' | 'video' | 'video_list' | string;

export interface T2IParam {
    name: string;
    id: string;
    description: string;
    type: ParamType;
    subtype: string | null;
    default: string;
    min: number;
    max: number;
    view_min?: number;
    view_max: number;
    step: number;
    values: string[] | null;
    value_names?: string[] | null;
    examples: string[] | null;
    visible: boolean;
    advanced: boolean;
    feature_flag: string | null;
    toggleable: boolean;
    priority: number;
    group: string | null;
    always_retain: boolean;
    do_not_save: boolean;
    do_not_preview: boolean;
    view_type: string;
    extra_hidden: boolean;
    can_sectionalize?: boolean;
    nonreusable?: boolean;
    depend_non_default?: string | null;
}

export interface T2IGroup {
    name: string;
    id: string;
    toggles: boolean;
    open: boolean;
    priority: number;
    description: string;
    advanced: boolean;
    can_shrink: boolean;
    parent: string | null;
}

export interface ListT2IParamsResponse {
    list: T2IParam[];
    groups: T2IGroup[];
    models: Record<string, [string, string][]>;
    model_compat_classes?: Record<string, any>;
    model_classes?: Record<string, any>;
    wildcards?: string[];
    param_edits?: any;
}

export interface SessionInfo {
    session_id: string;
    user_id: string;
    output_append_user: boolean;
    version: string;
    server_id: string;
    permissions: string[];
}

export interface GenStatus {
    waiting_gens: number;
    loading_models: number;
    waiting_backends: number;
    live_gens: number;
}

export interface BackendStatus {
    status: string;
    class: string;
    message: string;
    any_loading: boolean;
}

export interface CurrentStatus {
    status: GenStatus;
    backend_status: BackendStatus;
    supported_features: string[];
}

export interface ModelInfo {
    name: string;
    is_negative_embedding?: boolean;
    lora_default_weight?: string;
    lora_default_confinement?: string;
    special_format?: string;
    title?: string;
    author?: string;
    description?: string;
    preview_image?: string;
    loaded?: boolean;
    architecture?: string;
    class?: string;
    compat_class?: string;
    standard_width?: number;
    standard_height?: number;
    trigger_phrase?: string;
    usage_hint?: string;
    tags?: string[] | null;
    is_supported_model_format?: boolean;
    local?: boolean;
    [k: string]: any;
}

export interface ListModelsResponse {
    folders: string[];
    files: ModelInfo[];
}

export interface HistoryFile {
    src: string;
    metadata: string | null;
}

export interface ListImagesResponse {
    folders: string[];
    files: HistoryFile[];
}

export interface Preset {
    author: string;
    title: string;
    description: string;
    param_map: Record<string, any>;
    preview_image: string;
    is_starred?: boolean;
}

export interface UserData {
    user_name: string;
    presets: Preset[];
    language: string;
    permissions: string[];
    starred_models: Record<string, string[]>;
    model_preset_links?: any;
    autocompletions?: string[] | null;
}

export interface BackendInfo {
    id: number | string;
    type: string;
    status: string;
    settings: Record<string, any>;
    modcount: number;
    features: string[];
    enabled: boolean;
    title: string;
    can_load_models: boolean;
    max_usages: number;
    current_model?: string;
}

export interface GenWSMessage {
    status?: GenStatus;
    backend_status?: BackendStatus;
    supported_features?: string[];
    gen_progress?: {
        batch_index: string;
        overall_percent?: number;
        current_percent?: number;
        preview?: string;
        request_id?: string;
    };
    image?: { image: string; batch_index: string; metadata: string | null; request_id?: string };
    discard_indices?: number[];
    success?: string;
    error?: string;
    error_id?: string;
    socket_intention?: string;
}
