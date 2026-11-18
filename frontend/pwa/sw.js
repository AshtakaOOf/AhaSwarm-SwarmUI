const C = "shell-__VERSION__", ASSETS = __ASSETS__, BASE = new URL("./", self.location);
self.addEventListener("install", (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(C).then((c) => c.addAll([BASE.href, ...ASSETS.map((a) => new URL(a, BASE).href)])));
});
self.addEventListener("activate", (e) => e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("shell-") && k !== C) await caches.delete(k);
    await self.clients.claim();
})()));
self.addEventListener("fetch", (e) => {
    const r = e.request, u = new URL(r.url);
    if (r.method !== "GET" || u.origin !== location.origin) return;
    const path = u.pathname, base = BASE.pathname;
    if (!path.startsWith(base)) return;
    if (r.mode === "navigate") e.respondWith(nav(r));
    else if (path.startsWith(base + "assets/")) e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(C).then((x) => x.put(r, c)); } return res; })));
    else if (ASSETS.includes(path.slice(base.length))) e.respondWith(swr(e, r));
});
async function nav(r) {
    const index = new URL("index.html", BASE).href;
    const net = fetch(r).then((res) => {
        if (res.ok && res.type === "basic") { const c = res.clone(); caches.open(C).then((x) => { x.put(BASE.href, c.clone()); x.put(index, c); }); }
        return res;
    });
    try { return await Promise.race([net, new Promise((_, no) => setTimeout(no, 4000))]); }
    catch { return (await caches.match(r)) || (await caches.match(BASE.href)) || (await caches.match(index)) || net; }
}
async function swr(e, r) {
    const c = await caches.open(C), m = await c.match(r);
    const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => m || Response.error());
    if (m) { e.waitUntil(net); return m; }
    return net;
}
