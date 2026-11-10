
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#039': "'" };

export function escapeHtml(s: unknown): string {
  return `${s ?? ''}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripTags(h: unknown, oneLine = false): string {
  let s = `${h ?? ''}`.replace(/\r\n/g, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
  s = decodeEntities(s.replace(/<[^>]+>/g, oneLine ? ' ' : ''));
  return (oneLine ? s.replace(/\s+/g, ' ') : s).trim();
}

export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim();
}

export function safeUrl(url: unknown): string {
  const u = `${url ?? ''}`.trim();
  if (!u) return '';
  const probe = u.replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe)?.[1];
  if (!scheme) return probe.startsWith('//') ? `https:${u}` : u;
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' ? u : '';
}

export function linkify(raw: unknown): string {
  let s = `${raw ?? ''}`.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi, ' $1 ');
  s = stripTags(s);
  return escapeHtml(s).replace(/https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<>"'])+/g, (url) => {
    const shown = url.replace(/[),.;!?]+$/, '');
    const href = safeUrl(decodeEntities(shown));
    if (!href) return url;
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${shown}</a>${url.slice(shown.length)}`;
  }).replace(/\n/g, '<br>');
}
