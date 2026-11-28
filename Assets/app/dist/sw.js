const C = "shell-ffb511e63910", ASSETS = ["assets/BatchTool-D5YVIvGW.js","assets/BatchTool-legacy-B3hO4o3M.js","assets/ComfyTool-Bmku3by6.css","assets/ComfyTool-TCEgVwht.js","assets/ComfyTool-legacy-ClbY5AnM.js","assets/Grid-DMNUCfu7.js","assets/Grid-legacy-DZe8ArpD.js","assets/GridTool-C2t0AqaE.css","assets/GridTool-D1TSqR4f.js","assets/GridTool-legacy-ClhL0yCw.js","assets/ImageEditor-BRJZE1zS.css","assets/ImageEditor-BtCmU0VQ.js","assets/ImageEditor-legacy-CwMd3M9r.js","assets/ModelInfoModal-D5M7-4V3.css","assets/ModelInfoModal-Dn9APLvf.js","assets/ModelInfoModal-legacy-BrRkOhdH.js","assets/ModelsPage-4ajyH-hZ.js","assets/ModelsPage-RUhvkx5U.css","assets/ModelsPage-legacy-B5wVbm1F.js","assets/PresetsPage-C_y8sDqo.js","assets/PresetsPage-legacy-2G7tmSh4.js","assets/PresetsPage-vcAsoPKS.css","assets/ProgressPair-C1FlGnMf.js","assets/ProgressPair-legacy-u8Li3o0n.js","assets/RegionModal-C9JipPpc.js","assets/RegionModal-LdlR1j-z.css","assets/RegionModal-legacy-lk8yDOaB.js","assets/Section-DMDhELnF.js","assets/Section-legacy-Cj3lTDLr.js","assets/SegmentModal-CZj4pOKU.js","assets/SegmentModal-legacy-7LQgXLvT.js","assets/SegmentModal-tsdFEX1n.css","assets/SegmentedControl-CmL7Ozuo.js","assets/SegmentedControl-legacy-DCy5E96Z.js","assets/ServerPage-BSgkuVoi.css","assets/ServerPage-DS64sPzw.js","assets/ServerPage-legacy-B2oHOea0.js","assets/SettingsPage-4m2TSQsW.css","assets/SettingsPage-BLqbprOh.js","assets/SettingsPage-legacy-D_4LGx0g.js","assets/SettingsTree-CJt49EGz.css","assets/SettingsTree-CcyZE7q4.js","assets/SettingsTree-legacy-Ch151Oi8.js","assets/SimplePage-9rnhxyIG.js","assets/SimplePage-DGwU_rEi.css","assets/SimplePage-legacy-D8FdljPb.js","assets/Stats-BYHYV2sc.js","assets/Stats-legacy-BCDlrQ1L.js","assets/UtilitiesPage-YlqXO-94.js","assets/UtilitiesPage-ctRRiOhb.css","assets/UtilitiesPage-legacy-jMW5_nZF.js","assets/adwaita-Btw1E1Fm.css","assets/adwaita-legacy-BTBQMHWc.js","assets/adwaita-light-DHZNUrns.css","assets/adwaita-light-legacy-B2c7e7ko.js","assets/autumn-CxwCrfcU.css","assets/autumn-legacy-B-v_ANQs.js","assets/catppuccin-frappe-LaPd0kQJ.css","assets/catppuccin-frappe-legacy-CmBlo1sw.js","assets/catppuccin-latte-Cli-azXZ.css","assets/catppuccin-latte-legacy-PmjU5gFL.js","assets/catppuccin-macchiato-CcywAXA5.css","assets/catppuccin-macchiato-legacy-HOwcKsPW.js","assets/catppuccin-mocha-HkpUYVz-.css","assets/catppuccin-mocha-legacy-C4XrVgxq.js","assets/civitai-CYLu_H6x.js","assets/civitai-legacy-D15TfXPZ.js","assets/editor.svelte-Ciz0rK93.js","assets/editor.svelte-legacy-CfbwYbCV.js","assets/gruvbox-dark-B4JFPndM.css","assets/gruvbox-dark-legacy-yhT8FmHh.js","assets/gruvbox-light-WGjO-lel.css","assets/gruvbox-light-legacy-BdmQGDeZ.js","assets/high-contrast-DRr3OSLd.css","assets/high-contrast-legacy-E8XzU9Ns.js","assets/index-CJpoBAa1.js","assets/index-CkFp967j.css","assets/index-legacy-DoXOoWKi.js","assets/light-Cyy_2RWy.css","assets/light-legacy-CQRR3kO_.js","assets/list-checks-6xssVcxR.js","assets/list-checks-legacy-BBS7UiAD.js","assets/one-dark-DUjndS7S.css","assets/one-dark-legacy-D37BLupw.js","assets/oreui-CneM_wf_.css","assets/oreui-legacy-CXDhE5zU.js","assets/pencil-BLd4lcDB.js","assets/pencil-legacy-DIdcxtLj.js","assets/polyfills-legacy-BnbJISKd.js","assets/refresh-cw-Dsv4V1qL.js","assets/refresh-cw-legacy-DTqg8V9m.js","assets/rose-pine-CgK_txwe.css","assets/rose-pine-dawn-C7iR_R1x.css","assets/rose-pine-dawn-legacy-CUQzOHzw.js","assets/rose-pine-legacy-D2rpCA-y.js","assets/rose-pine-moon-B7rgaEQ4.css","assets/rose-pine-moon-legacy-BaHCUz_K.js","assets/rotate-ccw-clock-COK6jB8u.js","assets/rotate-ccw-clock-legacy-mFbM40uv.js","assets/sliders-horizontal-legacy-DNQxXp5S.js","assets/sliders-horizontal-nZpXrPzv.js","assets/square-dashed-legacy-CFVzpSfL.js","assets/square-dashed-noUndXCf.js","assets/text-BibRY1hW.js","assets/text-legacy-Iph0-CzC.js","assets/vapor-CLyhF96a.css","assets/vapor-legacy-Dr4ENx3j.js","assets/vgui2-ZZoTd9ef.css","assets/vgui2-legacy-XHd-RJ_F.js","icon.svg","manifest.webmanifest","pwa-192.png"], BASE = new URL("./", self.location);
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
