const C = "shell-b27027567fca", ASSETS = ["assets/BatchTool-D0VLlnWY.js","assets/BatchTool-legacy-BjzLO1rK.js","assets/ComfyTool-Bmku3by6.css","assets/ComfyTool-CR3iD2ir.js","assets/ComfyTool-legacy-7oxyGsaD.js","assets/FormRow-diqWRofh.js","assets/FormRow-legacy-D2mllfLO.js","assets/Grid-D620cDe-.js","assets/Grid-legacy-CHsMf37H.js","assets/GridTool-C2t0AqaE.css","assets/GridTool-D7Bz042c.js","assets/GridTool-legacy-QOKkQGd6.js","assets/ImageEditor-BRJZE1zS.css","assets/ImageEditor-Dhavi43C.js","assets/ImageEditor-legacy-DZzAouQo.js","assets/ModelInfoModal-BfLrHCTA.js","assets/ModelInfoModal-D5M7-4V3.css","assets/ModelInfoModal-legacy-0YAjn1ah.js","assets/ModelsPage-DlLlYFaF.js","assets/ModelsPage-f52SIKGt.css","assets/ModelsPage-legacy-BU6FZFyb.js","assets/PresetsPage-CP1QOquB.js","assets/PresetsPage-DH4VfyAq.css","assets/PresetsPage-legacy-DOoarvu3.js","assets/ProgressPair-BIHGE_eL.js","assets/ProgressPair-legacy-ZnNzns9I.js","assets/RegionModal-Dd04N_9A.js","assets/RegionModal-LdlR1j-z.css","assets/RegionModal-legacy-DNeU05kh.js","assets/Section-legacy-BYM6UMrZ.js","assets/Section-nqpEVNSL.js","assets/SegmentModal-KaoK7Fpu.js","assets/SegmentModal-legacy-lINKr2v9.js","assets/SegmentModal-tsdFEX1n.css","assets/SegmentedControl-D5jUemlk.js","assets/SegmentedControl-legacy-BJODBnVO.js","assets/ServerPage-BSgkuVoi.css","assets/ServerPage-Dh98x2GE.js","assets/ServerPage-legacy-7GV6pBas.js","assets/SettingsPage-Cm1v6qeO.css","assets/SettingsPage-D_RijdEJ.js","assets/SettingsPage-legacy-CPsHb9LW.js","assets/SettingsTree-BLuyrfkT.js","assets/SettingsTree-W-RSytni.css","assets/SettingsTree-legacy-LrYvhIY6.js","assets/SimplePage-DGwU_rEi.css","assets/SimplePage-Dwj9lAbS.js","assets/SimplePage-legacy-QHJKGpLu.js","assets/Stats-CudkkAn2.js","assets/Stats-legacy-DSwYLgg2.js","assets/UtilitiesPage-DTC3gTcU.js","assets/UtilitiesPage-ctRRiOhb.css","assets/UtilitiesPage-legacy-BjVElBwe.js","assets/adwaita-Btw1E1Fm.css","assets/adwaita-legacy-BTBQMHWc.js","assets/adwaita-light-DHZNUrns.css","assets/adwaita-light-legacy-B2c7e7ko.js","assets/autumn-CxwCrfcU.css","assets/autumn-legacy-B-v_ANQs.js","assets/catppuccin-frappe-LaPd0kQJ.css","assets/catppuccin-frappe-legacy-CmBlo1sw.js","assets/catppuccin-latte-Cli-azXZ.css","assets/catppuccin-latte-legacy-PmjU5gFL.js","assets/catppuccin-macchiato-CcywAXA5.css","assets/catppuccin-macchiato-legacy-HOwcKsPW.js","assets/catppuccin-mocha-HkpUYVz-.css","assets/catppuccin-mocha-legacy-C4XrVgxq.js","assets/civitai-DkHPBZXW.js","assets/civitai-legacy-UwQt8CEj.js","assets/editor.svelte-legacy-QAeeMZZu.js","assets/editor.svelte-xg5vOEqP.js","assets/gruvbox-dark-B4JFPndM.css","assets/gruvbox-dark-legacy-yhT8FmHh.js","assets/gruvbox-light-WGjO-lel.css","assets/gruvbox-light-legacy-BdmQGDeZ.js","assets/high-contrast-DRr3OSLd.css","assets/high-contrast-legacy-E8XzU9Ns.js","assets/index-BTCffPAe.js","assets/index-D4MfBaJ4.css","assets/index-legacy-BF8TTr_I.js","assets/light-Cyy_2RWy.css","assets/light-legacy-CQRR3kO_.js","assets/list-checks-cz-ja7I4.js","assets/list-checks-legacy-vdw30jII.js","assets/one-dark-DUjndS7S.css","assets/one-dark-legacy-D37BLupw.js","assets/oreui-BZqoJIRa.css","assets/oreui-legacy-jcyeu0YY.js","assets/pencil-7VI9Xrlm.js","assets/pencil-legacy-8N6ja1Ca.js","assets/polyfills-legacy-DotmFtIr.js","assets/refresh-cw-BKciPnSD.js","assets/refresh-cw-legacy-Bk0C1R4x.js","assets/rose-pine-CgK_txwe.css","assets/rose-pine-dawn-C7iR_R1x.css","assets/rose-pine-dawn-legacy-CUQzOHzw.js","assets/rose-pine-legacy-D2rpCA-y.js","assets/rose-pine-moon-B7rgaEQ4.css","assets/rose-pine-moon-legacy-BaHCUz_K.js","assets/rotate-ccw-clock-DSdkFwQY.js","assets/rotate-ccw-clock-legacy-sOJfYJ4O.js","assets/sliders-horizontal-B-g8Uzk7.js","assets/sliders-horizontal-legacy-pH10XVan.js","assets/square-dashed-BAErqSHq.js","assets/square-dashed-legacy-B2OHrf6h.js","assets/text-BibRY1hW.js","assets/text-legacy-Iph0-CzC.js","assets/vapor-CLyhF96a.css","assets/vapor-legacy-Dr4ENx3j.js","assets/vgui2-ZZoTd9ef.css","assets/vgui2-legacy-XHd-RJ_F.js","icon.svg","manifest.webmanifest","pwa-192.png"], BASE = new URL("./", self.location);
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
