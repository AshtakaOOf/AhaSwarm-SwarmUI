export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
export type Size = 'sm' | 'md' | 'hero';
export type Value = string | number;
export interface Option<V extends Value = Value> {
  value: V;
  label: string;
  title?: string;
  disabled?: boolean;
}
export interface TabItem {
  id: string;
  label: string;
  // optional Lucide icon before the label
  icon?: import('@lucide/svelte').LucideIcon;
  title?: string;
  disabled?: boolean;
}
export interface GalleryItem {
  id?: string | number;
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
}
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type Status = 'idle' | 'queued' | 'running' | 'success' | 'warning' | 'error' | 'offline';
export interface Crumb {
  label: string;
  href?: string;
  title?: string;
}
export interface KeyValue {
  key: string;
  value: string | number | null | undefined;
  title?: string;
  mono?: boolean;
  copy?: boolean;
  chips?: string[];
}
export interface MenuItem {
  id?: string;
  label?: string;
  icon?: import('@lucide/svelte').LucideIcon;
  fill?: string;
  shortcut?: string;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separator?: boolean;
  items?: MenuItem[];
  onselect?: () => void;
}
export interface MenuTriggerProps {
  id: string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  onclick: (e: MouseEvent) => void;
  onkeydown: (e: KeyboardEvent) => void;
}
export interface SuggestItem {
  id?: string | number;
  label: string;
  detail?: string;
  icon?: import('@lucide/svelte').LucideIcon;
  title?: string;
  disabled?: boolean;
}
export interface PopoverTriggerProps {
  id: string;
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  'aria-controls': string;
  onclick: (e: MouseEvent) => void;
}
export interface TreeItem {
  count?: number;
  id: string | number;
  label: string;
  icon?: import('@lucide/svelte').LucideIcon;
  title?: string;
  disabled?: boolean;
  children?: TreeItem[];
  lazy?: boolean;
}
