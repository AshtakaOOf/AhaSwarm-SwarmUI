<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import VolumeX from '@lucide/svelte/icons/volume-x';
  import { mediaTime } from './mediaTime';

  let { src, autoplay = false, label = 'Audio', class: cls = '' }: { src: string; autoplay?: boolean; label?: string; class?: string } = $props();
  const BARS = 160;
  let audio: HTMLAudioElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let wave: HTMLDivElement | undefined = $state();
  let paused = $state(true), time = $state(0), duration = $state(0), volume = $state(1), muted = $state(false);
  let url = $state(''), peaks = $state<number[] | null>(null), hover = $state<number | null>(null), w = $state(0), h = $state(0);

  $effect(() => {
    const s = src, ctl = new AbortController();
    let made = '';
    peaks = null;
    url = '';
    fetch(s, { signal: ctl.signal }).then(r => { if (!r.ok) throw new Error(); return r.blob(); }).then(async (b) => {
      url = made = URL.createObjectURL(b);
      const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await b.arrayBuffer());
      const ch = buf.getChannelData(0), step = Math.max(1, Math.floor(ch.length / BARS)), out: number[] = [];
      for (let i = 0; i < BARS; i++) {
        let m = 0;
        for (let j = i * step, e = Math.min(ch.length, j + step); j < e; j += 4) { const v = Math.abs(ch[j]); if (v > m) m = v; }
        out.push(m);
      }
      const top = Math.max(...out) || 1;
      if (!ctl.signal.aborted) peaks = out.map(v => v / top);
    }).catch(() => { if (!ctl.signal.aborted && !url) url = s; });
    return () => { ctl.abort(); if (made) URL.revokeObjectURL(made); };
  });

  $effect(() => {
    const c = canvas, p = peaks, frac = duration ? time / duration : 0, hv = hover;
    if (!c || !w || !h) return;
    const dpr = devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const css = getComputedStyle(c), on = css.color, off = css.getPropertyValue('--wave-rest').trim() || 'gray';
    const bw = 2, gap = 1, n = Math.max(1, Math.floor(w / (bw + gap)));
    for (let i = 0; i < n; i++) {
      const x = i * (bw + gap), at = (x + bw / 2) / w;
      const v = p ? p[Math.min(p.length - 1, Math.floor((i / n) * p.length))] : 0;
      const bh = Math.max(2, v * (h - 2));
      g.globalAlpha = at <= frac ? 1 : hv !== null && at <= hv ? 0.55 : 1;
      g.fillStyle = at <= frac || (hv !== null && at <= hv) ? on : off;
      g.fillRect(x, (h - bh) / 2, bw, bh);
    }
    g.globalAlpha = 1;
  });

  const toggle = () => { if (!audio) return; if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  const at = (e: PointerEvent) => { const r = wave!.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
  let drag = false;
  function down(e: PointerEvent) {
    if (!duration) return;
    drag = true;
    wave!.setPointerCapture(e.pointerId);
    time = at(e) * duration;
  }
  function move(e: PointerEvent) {
    hover = at(e);
    if (drag && duration) time = hover * duration;
  }
  function key(e: KeyboardEvent) {
    if (!duration) return;
    const d = e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : e.key === 'Home' ? -Infinity : e.key === 'End' ? Infinity : 0;
    if (d) { e.preventDefault(); time = Math.max(0, Math.min(duration, time + d)); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
  }
</script>

<div class="ui-audio {cls}" role="group" aria-label={label}>
  <button type="button" class="play" aria-label={paused ? 'Play' : 'Pause'} onclick={toggle}>
    {#if paused}<Play size={18} fill="currentColor" aria-hidden="true" />{:else}<Pause size={18} fill="currentColor" aria-hidden="true" />{/if}
  </button>
  <div class="main">
    <div bind:this={wave} class="wave" bind:clientWidth={w} bind:clientHeight={h} role="slider" tabindex="0" aria-label="Seek {label}"
      aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)} aria-valuetext="{mediaTime(time)} of {mediaTime(duration)}"
      onpointerdown={down} onpointermove={move} onpointerup={() => (drag = false)} onpointercancel={() => (drag = false)} onpointerleave={() => (hover = null)} onkeydown={key}>
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
      {#if hover !== null && duration}<span class="tip" style:left="{hover * 100}%">{mediaTime(hover * duration)}</span>{/if}
    </div>
    <div class="row">
      <span class="time">{mediaTime(time)} / {mediaTime(duration)}</span>
      <span class="vols">
        <button type="button" class="vb" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onclick={() => (muted = !muted)}>
          {#if muted || volume === 0}<VolumeX size={14} aria-hidden="true" />{:else}<Volume2 size={14} aria-hidden="true" />{/if}
        </button>
        <input class="vol" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label="Volume" style:--v="{(muted ? 0 : volume) * 100}%"
          oninput={(e) => { volume = Number((e.currentTarget as HTMLInputElement).value); muted = volume === 0; }} />
      </span>
    </div>
  </div>
  {#if url}<audio bind:this={audio} src={url} {autoplay} preload="metadata" bind:paused bind:currentTime={time} bind:duration bind:volume bind:muted></audio>{/if}
</div>

<style>
  .ui-audio { display: flex; align-items: center; gap: var(--space-2); width: min(560px, 100%); padding: var(--space-3);
    border-radius: var(--radius-ui); background: var(--color-panel); box-shadow: var(--shadow-float); }
  .play { flex: none; display: grid; place-items: center; width: 44px; height: 44px; padding: 0 0 0 2px; border: 0; border-radius: var(--radius-ui); cursor: pointer;
    background: var(--color-accent); color: var(--color-on-accent, #fff); transition: filter var(--motion-fast); }
  .play:hover { filter: brightness(1.08); }
  .play:focus-visible, .wave:focus-visible, .vb:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }
  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .wave { position: relative; height: 88px; cursor: pointer; touch-action: none; border-radius: var(--radius-sm); }
  canvas { display: block; width: 100%; height: 100%; color: var(--color-accent); --wave-rest: var(--color-active); }
  .tip { position: absolute; top: -20px; translate: -50% 0; padding: 1px 5px; border-radius: var(--radius-sm); font-size: 11px; font-variant-numeric: tabular-nums;
    background: var(--color-surface); color: var(--color-ink); box-shadow: var(--shadow-float); pointer-events: none; white-space: nowrap; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .time { font-size: 11px; font-variant-numeric: tabular-nums; color: var(--color-ink-2); white-space: nowrap; }
  .vols { display: flex; align-items: center; gap: 4px; }
  .vb { display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-ink-2); cursor: pointer; }
  .vb:hover { background: var(--color-hover); color: var(--color-ink); }
  .vol { width: 64px; height: 16px; margin: 0; background: transparent; appearance: none; -webkit-appearance: none; cursor: pointer; }
  .vol::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: linear-gradient(to right, var(--color-accent) var(--v), var(--color-active) var(--v)); }
  .vol::-moz-range-track { height: 4px; border-radius: 999px; background: linear-gradient(to right, var(--color-accent) var(--v), var(--color-active) var(--v)); }
  .vol::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; margin-top: -3px; border: 0; border-radius: 50%; background: var(--color-ink); }
  .vol::-moz-range-thumb { width: 10px; height: 10px; border: 0; border-radius: 50%; background: var(--color-ink); }
  @media (prefers-reduced-motion: reduce) { .play { transition: none; } }
  @media (forced-colors: active) { canvas { forced-color-adjust: none; color: Highlight; --wave-rest: GrayText; } }
</style>
