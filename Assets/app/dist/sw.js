const C = "shell-e0d8e158f21a", ASSETS = ["assets/BatchTool-DEr5WT4T.js","assets/BatchTool-legacy-BjKvqxaD.js","assets/ComfyTool-Bmku3by6.css","assets/ComfyTool-Cq8TplMY.js","assets/ComfyTool-legacy-DGsuH8IL.js","assets/Grid-IDn1LlpX.js","assets/Grid-legacy-BRsbCE1Q.js","assets/GridTool-BvyUFkLA.js","assets/GridTool-C2t0AqaE.css","assets/GridTool-legacy-DsVi5E_M.js","assets/ImageEditor-BRJZE1zS.css","assets/ImageEditor-CO3GWTth.js","assets/ImageEditor-legacy-CUJyvowM.js","assets/ModelInfoModal-BBXUVpHL.js","assets/ModelInfoModal-D5M7-4V3.css","assets/ModelInfoModal-legacy-BLfe2fPh.js","assets/ModelsPage-RUhvkx5U.css","assets/ModelsPage-WTndg7dP.js","assets/ModelsPage-legacy-D1j3KuKy.js","assets/PresetsPage-DH4VfyAq.css","assets/PresetsPage-legacy-ChIxYv27.js","assets/PresetsPage-twsVtFVF.js","assets/ProgressPair-ClRE_P67.js","assets/ProgressPair-legacy-NP777nB0.js","assets/RegionModal-DPiDbyi8.js","assets/RegionModal-LdlR1j-z.css","assets/RegionModal-legacy-CbRcBvYc.js","assets/Section-BKroFyzR.js","assets/Section-legacy-BprQTC3G.js","assets/SegmentModal-B4ufC4Yb.js","assets/SegmentModal-legacy-B9-fKMfh.js","assets/SegmentModal-tsdFEX1n.css","assets/SegmentedControl-legacy-BtMw6Psg.js","assets/SegmentedControl-u_hcvsCB.js","assets/ServerPage-BSgkuVoi.css","assets/ServerPage-BWYGYyeM.js","assets/ServerPage-legacy-BxPTvkIP.js","assets/SettingsPage-4m2TSQsW.css","assets/SettingsPage-BTdJRdEs.js","assets/SettingsPage-legacy-Cg9x5iYZ.js","assets/SettingsTree-W-RSytni.css","assets/SettingsTree-legacy-CCXv4uYz.js","assets/SettingsTree-tsd0sWpj.js","assets/SimplePage-BmVydbJ1.js","assets/SimplePage-DGwU_rEi.css","assets/SimplePage-legacy-DbrQjiQC.js","assets/Stats-Bndn4zu_.js","assets/Stats-legacy-DAUqXJ4d.js","assets/UtilitiesPage-DufAt8aO.js","assets/UtilitiesPage-ctRRiOhb.css","assets/UtilitiesPage-legacy-CYaaPgzT.js","assets/adwaita-Btw1E1Fm.css","assets/adwaita-legacy-BTBQMHWc.js","assets/adwaita-light-DHZNUrns.css","assets/adwaita-light-legacy-B2c7e7ko.js","assets/autumn-CxwCrfcU.css","assets/autumn-legacy-B-v_ANQs.js","assets/catppuccin-frappe-LaPd0kQJ.css","assets/catppuccin-frappe-legacy-CmBlo1sw.js","assets/catppuccin-latte-Cli-azXZ.css","assets/catppuccin-latte-legacy-PmjU5gFL.js","assets/catppuccin-macchiato-CcywAXA5.css","assets/catppuccin-macchiato-legacy-HOwcKsPW.js","assets/catppuccin-mocha-HkpUYVz-.css","assets/catppuccin-mocha-legacy-C4XrVgxq.js","assets/civitai-DKcBnan_.js","assets/civitai-legacy-BLU_o9Oe.js","assets/editor.svelte-CeO7_Kcs.js","assets/editor.svelte-legacy-CSGddKmx.js","assets/gruvbox-dark-B4JFPndM.css","assets/gruvbox-dark-legacy-yhT8FmHh.js","assets/gruvbox-light-WGjO-lel.css","assets/gruvbox-light-legacy-BdmQGDeZ.js","assets/high-contrast-DRr3OSLd.css","assets/high-contrast-legacy-E8XzU9Ns.js","assets/index-C7oW825q.css","assets/index-D5t8Wt_M.js","assets/index-legacy-CbZJ_UHd.js","assets/light-Cyy_2RWy.css","assets/light-legacy-CQRR3kO_.js","assets/list-checks-D7ha6rB8.js","assets/list-checks-legacy-Cs7059AD.js","assets/one-dark-DUjndS7S.css","assets/one-dark-legacy-D37BLupw.js","assets/oreui-BZqoJIRa.css","assets/oreui-legacy-jcyeu0YY.js","assets/pencil-Slj-aUp2.js","assets/pencil-legacy-DRL2M4Kn.js","assets/polyfills-legacy-BnbJISKd.js","assets/refresh-cw-B7p39P0S.js","assets/refresh-cw-legacy-_E6G4o2E.js","assets/rose-pine-CgK_txwe.css","assets/rose-pine-dawn-C7iR_R1x.css","assets/rose-pine-dawn-legacy-CUQzOHzw.js","assets/rose-pine-legacy-D2rpCA-y.js","assets/rose-pine-moon-B7rgaEQ4.css","assets/rose-pine-moon-legacy-BaHCUz_K.js","assets/rotate-ccw-clock-ChvN3YjA.js","assets/rotate-ccw-clock-legacy-LcA7WsTt.js","assets/sliders-horizontal-DmU7cphw.js","assets/sliders-horizontal-legacy-wC_mK62K.js","assets/square-dashed-33EydY0k.js","assets/square-dashed-legacy-C-Vek_6p.js","assets/text-BibRY1hW.js","assets/text-legacy-Iph0-CzC.js","assets/vapor-CLyhF96a.css","assets/vapor-legacy-Dr4ENx3j.js","assets/vgui2-ZZoTd9ef.css","assets/vgui2-legacy-XHd-RJ_F.js","icon.svg","manifest.webmanifest","pwa-192.png"], BASE = new URL("./", self.location);
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
