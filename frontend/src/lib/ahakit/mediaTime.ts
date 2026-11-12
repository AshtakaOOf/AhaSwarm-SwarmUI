// m:ss (or h:mm:ss) for media players; '-:--' before the duration is known
export function mediaTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '-:--';
  const t = Math.floor(s), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = `${t % 60}`.padStart(2, '0');
  return h ? `${h}:${`${m}`.padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
