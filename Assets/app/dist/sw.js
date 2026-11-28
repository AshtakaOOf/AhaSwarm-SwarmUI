const C = "shell-cd5054562d8f", ASSETS = ["assets/BatchTool-26C2JbGN.js","assets/BatchTool-legacy-C7WpfWe0.js","assets/ComfyTool-Bmku3by6.css","assets/ComfyTool-NsK7r9Wf.js","assets/ComfyTool-legacy-AaROgLcY.js","assets/Grid-CMLuVO03.js","assets/Grid-legacy-eNJ114uA.js","assets/GridTool-BuukyNO7.js","assets/GridTool-C2t0AqaE.css","assets/GridTool-legacy-dKVWVMHX.js","assets/ImageEditor-BRJZE1zS.css","assets/ImageEditor-legacy-DbyV5frb.js","assets/ImageEditor-suS3s1dE.js","assets/ModelInfoModal-D5M7-4V3.css","assets/ModelInfoModal-DIahRtrB.js","assets/ModelInfoModal-legacy-SHN_FSsE.js","assets/ModelsPage-CejCjIes.js","assets/ModelsPage-RUhvkx5U.css","assets/ModelsPage-legacy-ZbzYAyLE.js","assets/PresetsPage-Dfz0Lpf1.js","assets/PresetsPage-legacy-DcpBd8pM.js","assets/PresetsPage-vcAsoPKS.css","assets/ProgressPair-Ck5M8r03.js","assets/ProgressPair-legacy-DWj2r7Ml.js","assets/RegionModal-BR1xTfxT.js","assets/RegionModal-LdlR1j-z.css","assets/RegionModal-legacy-CdkCJ_jK.js","assets/Section-DZTzXPvU.js","assets/Section-legacy-C7Hna5gz.js","assets/SegmentModal-BYCN18r4.js","assets/SegmentModal-legacy-BYM9w7vK.js","assets/SegmentModal-tsdFEX1n.css","assets/SegmentedControl-XeFCb4X2.js","assets/SegmentedControl-legacy-BtNmqvgD.js","assets/ServerPage-BSgkuVoi.css","assets/ServerPage-Dh1DMQqj.js","assets/ServerPage-legacy-DW7liBwv.js","assets/SettingsPage-4m2TSQsW.css","assets/SettingsPage-DrMy1gUS.js","assets/SettingsPage-legacy-CmT1t8VZ.js","assets/SettingsTree-6j5joM0I.js","assets/SettingsTree-CJt49EGz.css","assets/SettingsTree-legacy-BXGRWrg0.js","assets/SimplePage-DGleF6AG.js","assets/SimplePage-DGwU_rEi.css","assets/SimplePage-legacy-D1FM4Z5-.js","assets/Stats-CwxHrvsp.js","assets/Stats-legacy-CQ61L3Wj.js","assets/UtilitiesPage-74mFyKwB.js","assets/UtilitiesPage-ctRRiOhb.css","assets/UtilitiesPage-legacy-CvprmSTs.js","assets/adwaita-Btw1E1Fm.css","assets/adwaita-legacy-BTBQMHWc.js","assets/adwaita-light-DHZNUrns.css","assets/adwaita-light-legacy-B2c7e7ko.js","assets/autumn-CxwCrfcU.css","assets/autumn-legacy-B-v_ANQs.js","assets/catppuccin-frappe-LaPd0kQJ.css","assets/catppuccin-frappe-legacy-CmBlo1sw.js","assets/catppuccin-latte-Cli-azXZ.css","assets/catppuccin-latte-legacy-PmjU5gFL.js","assets/catppuccin-macchiato-CcywAXA5.css","assets/catppuccin-macchiato-legacy-HOwcKsPW.js","assets/catppuccin-mocha-HkpUYVz-.css","assets/catppuccin-mocha-legacy-C4XrVgxq.js","assets/civitai-DFMnTFtg.js","assets/civitai-legacy-ASO94Wak.js","assets/editor.svelte-legacy-Cqp7phRC.js","assets/editor.svelte-quVVa5gZ.js","assets/gruvbox-dark-B4JFPndM.css","assets/gruvbox-dark-legacy-yhT8FmHh.js","assets/gruvbox-light-WGjO-lel.css","assets/gruvbox-light-legacy-BdmQGDeZ.js","assets/high-contrast-DRr3OSLd.css","assets/high-contrast-legacy-E8XzU9Ns.js","assets/index-0dAREX5r.css","assets/index-3W9A_db4.js","assets/index-legacy-Bw_0vg6Z.js","assets/light-Cyy_2RWy.css","assets/light-legacy-CQRR3kO_.js","assets/list-checks-BxXPGMDr.js","assets/list-checks-legacy-BaTxFeTY.js","assets/one-dark-DUjndS7S.css","assets/one-dark-legacy-D37BLupw.js","assets/oreui-BZqoJIRa.css","assets/oreui-legacy-jcyeu0YY.js","assets/pencil-DBuQgyQ4.js","assets/pencil-legacy-NdjsTiPc.js","assets/polyfills-legacy-BnbJISKd.js","assets/refresh-cw-legacy-X8uC9jKt.js","assets/refresh-cw-t8ysLE1m.js","assets/rose-pine-CgK_txwe.css","assets/rose-pine-dawn-C7iR_R1x.css","assets/rose-pine-dawn-legacy-CUQzOHzw.js","assets/rose-pine-legacy-D2rpCA-y.js","assets/rose-pine-moon-B7rgaEQ4.css","assets/rose-pine-moon-legacy-BaHCUz_K.js","assets/rotate-ccw-clock-B2El7wE6.js","assets/rotate-ccw-clock-legacy-BAI1SkDU.js","assets/sliders-horizontal-B_lamedk.js","assets/sliders-horizontal-legacy-DMCRn0OK.js","assets/square-dashed-CcGQnMaR.js","assets/square-dashed-legacy-C4KtFrvt.js","assets/text-BibRY1hW.js","assets/text-legacy-Iph0-CzC.js","assets/vapor-CLyhF96a.css","assets/vapor-legacy-Dr4ENx3j.js","assets/vgui2-ZZoTd9ef.css","assets/vgui2-legacy-XHd-RJ_F.js","icon.svg","manifest.webmanifest","pwa-192.png"], BASE = new URL("./", self.location);
self.addEventListener("message", (e) => { if (e.data === "skipWaiting" || e.data?.type === "skipWaiting") self.skipWaiting(); });
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
