import type { Stroke } from './brush';
import type { Layer, Rect } from './layer';
import type { LiquifyWarp } from './pixels';
import type { SelectionShape } from './selection';
import type { TextSpec } from './text';
import type { Transform, XHandle } from './transform';

export type ToolId = 'brush' | 'airbrush' | 'eraser' | 'eyedropper' | 'fill' | 'lassofill' | 'rect' | 'ellipse' | 'lasso' | 'move' | 'liquify' | 'text' | 'hand';

export const BRUSH_TOOLS: ToolId[] = ['brush', 'airbrush', 'eraser'];
export const MIN_ZOOM = 0.02, MAX_ZOOM = 32;

export interface Pt { x: number; y: number }
export interface PointerInfo extends Pt { type: string }

export type Action =
    | { kind: 'stroke'; layer: Layer; stroke: Stroke; timer: number; touch: boolean }
    | { kind: 'pan'; last: Pt }
    | { kind: 'pinch'; dist: number; mid: Pt }
    | { kind: 'pick' }
    | { kind: 'select'; shape: SelectionShape; fill?: Layer }
    | { kind: 'move'; layer: Layer; start: Pt; ox: number; oy: number; float: HTMLCanvasElement | null; dx: number; dy: number }
    | { kind: 'liquify'; layer: Layer; last: Pt; dirty: Rect | null; warp: LiquifyWarp }
    | { kind: 'xform'; handle: XHandle; snap: ReturnType<Transform['snapshot']>; from: Pt }
    | { kind: 'textmove'; layer: Layer; start: Pt; ox: number; oy: number };

export type Clip = { canvas: HTMLCanvasElement; x: number; y: number; isMask: boolean; name: string; text?: TextSpec };
