<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import Volume1 from '@lucide/svelte/icons/volume-1';
  import VolumeX from '@lucide/svelte/icons/volume-x';
  import Settings from '@lucide/svelte/icons/settings';
  import Maximize from '@lucide/svelte/icons/maximize';
  import Minimize from '@lucide/svelte/icons/minimize';
  import IconButton from './IconButton.svelte';
  import Slider from './Slider.svelte';
  import Menu from './Menu.svelte';
  import { mediaTime } from './mediaTime';
  import type { MenuItem } from './types';

  let { src, autoplay = true, loop = $bindable(true), muted = $bindable(true), label = 'Video', class: cls = '' }: {
    src: string; autoplay?: boolean; loop?: boolean; muted?: boolean; label?: string; class?: string;
  } = $props();
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let box: HTMLDivElement | undefined = $state();
  let vid: HTMLVideoElement | undefined = $state();
  let paused = $state(true), time = $state(0), duration = $state(0), volume = $state(1), rate = $state(1), full = $state(false);
  let buffered = $state(0), idle = $state(false), menu = $state(false);
  let timer = 0;
  const shown = $derived(paused || menu || !idle);
  const VolIcon = $derived(muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2);
  const items = $derived<MenuItem[]>([
    { label: 'Speed', items: SPEEDS.map(s => ({ label: s === 1 ? 'Normal' : `${s}×`, checked: rate === s, onselect: () => (rate = s) })) },
    { separator: true },
    { label: 'Loop', checked: loop, onselect: () => (loop = !loop) },
  ]);
  let inset = $state({ x: 0, y: 0 });
  function fit() {
    if (!box || !vid?.videoWidth) return;
    const bw = box.clientWidth, bh = box.clientHeight, s = Math.min(bw / vid.videoWidth, bh / vid.videoHeight);
    inset = { x: Math.max(0, (bw - vid.videoWidth * s) / 2), y: Math.max(0, (bh - vid.videoHeight * s) / 2) };
  }
  $effect(() => {
    if (!box) return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  });

  const toggle = () => { if (!vid) return; if (vid.paused) vid.play().catch(() => {}); else vid.pause(); };
  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else box?.requestFullscreen?.(); };
  function wake() {
    idle = false;
    clearTimeout(timer);
    timer = window.setTimeout(() => (idle = true), 2200);
  }
  $effect(() => () => clearTimeout(timer));
  function onBuffer() {
    if (!vid || !duration) return;
    const b = vid.buffered;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= vid.currentTime + 0.1) buffered = (b.end(i) / duration) * 100;
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, button')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'm') muted = !muted;
    else if (k === 'f') fullscreen();
    else if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); time = Math.max(0, Math.min(duration, time + (k === 'arrowleft' ? -5 : 5))); }
    wake();
  }
</script>

<svelte:document onfullscreenchange={() => (full = document.fullscreenElement === box)} />
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (the player's keyboard shortcuts) -->
<div bind:this={box} class="ui-video {cls}" class:shown class:full style:--vp-x="{inset.x}px" style:--vp-y="{inset.y}px" role="group" aria-label={label} tabindex="0"
  onkeydown={key} onpointermove={wake} onpointerleave={() => { if (!paused && !menu) idle = true; }}>
  <!-- svelte-ignore a11y_media_has_caption, a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (keys on the group) -->
  <video bind:this={vid} {src} {autoplay} {loop} bind:muted bind:paused bind:currentTime={time} bind:duration bind:volume bind:playbackRate={rate}
    playsinline onclick={toggle} ondblclick={fullscreen} onprogress={onBuffer} ontimeupdate={onBuffer} onloadedmetadata={fit}></video>
  <div class="bar ui-dense">
    <IconButton size="sm" icon={paused ? Play : Pause} fill="currentColor" label={paused ? 'Play' : 'Pause'} onclick={toggle} />
    <div class="seek"><Slider number={false} value={time} min={0} max={duration || 1} step={0.01} buffered={buffered} disabled={!duration}
      ariaLabel="Seek {label}" valueText="{mediaTime(time)} of {mediaTime(duration)}" oninput={(v) => (time = v)} /></div>
    <span class="time">{mediaTime(time)}<span class="dur">&nbsp;/ {mediaTime(duration)}</span></span>
    <IconButton size="sm" icon={VolIcon} label={muted ? 'Unmute' : 'Mute'} onclick={() => (muted = !muted)} />
    <div class="vol"><Slider number={false} value={muted ? 0 : volume} min={0} max={1} step={0.05} ariaLabel="Volume"
      valueText="{Math.round((muted ? 0 : volume) * 100)}%" oninput={(v) => { volume = v; muted = v === 0; }} /></div>
    <Menu {items} bind:open={menu} label="Playback settings">
      {#snippet trigger(p)}<IconButton {...p} size="sm" icon={Settings} label="Settings" />{/snippet}
    </Menu>
    <IconButton size="sm" icon={full ? Minimize : Maximize} label={full ? 'Exit full screen' : 'Full screen'} onclick={fullscreen} />
  </div>
</div>

<style>
  .ui-video { position: relative; display: flex; max-width: 100%; max-height: 100%; overflow: hidden; outline: none; border-radius: inherit;
    background: var(--color-media, #000); }
  .ui-video:not(.shown) { cursor: none; }
  .ui-video video { display: block; max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; }
  .ui-video.full video { max-height: none; }
  .bar { --color-ink: var(--color-media-ink, #fff); --color-ink-2: var(--color-media-ink, #fff); --color-hover: rgb(255 255 255 / 0.14);
    --color-active: rgb(255 255 255 / 0.22); --color-track: rgb(255 255 255 / 0.22); --color-track-buffered: rgb(255 255 255 / 0.4);
    position: absolute; left: var(--vp-x, 0); right: var(--vp-x, 0); bottom: var(--vp-y, 0); display: flex; align-items: center; gap: 2px;
    padding: 32px max(8px, calc(var(--vp-clear-x, 0px) - var(--vp-x, 0px))) max(6px, calc(var(--vp-clear-b, 0px) - var(--vp-y, 0px)));
    background: var(--media-scrim);
    color: var(--color-ink); opacity: 0; pointer-events: none; transition: opacity var(--motion-base); }
  .shown .bar, .ui-video:focus-within .bar { opacity: 1; pointer-events: auto; }
  .seek { flex: 1; min-width: 40px; display: flex; margin: 0 6px; }
  .vol { width: 64px; display: flex; margin-right: 4px; }
  .time { flex: none; padding: 0 4px; font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ui-video:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }
  @media (max-width: 480px) { .dur, .vol { display: none; } }
  @media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
  @media (forced-colors: active) { .bar { background: Canvas; } }
</style>
