const C = "shell-8174bce9ba8b", ASSETS = ["assets/BatchTool-legacy-jw9Qf8L2.js","assets/BatchTool-zpz2inpq.js","assets/ComfyTool-Bmku3by6.css","assets/ComfyTool-Jl3FU4xJ.js","assets/ComfyTool-legacy-D2ukjO36.js","assets/Grid-CfDDhRrP.js","assets/Grid-legacy-D51zUhEe.js","assets/GridTool-BW9KrrGk.js","assets/GridTool-C2t0AqaE.css","assets/GridTool-legacy-Bm2bd1-8.js","assets/ImageEditor-BRJZE1zS.css","assets/ImageEditor-Ct7rWivU.js","assets/ImageEditor-legacy-Ctu3d2CM.js","assets/ModelInfoModal-9Pw6-mnf.js","assets/ModelInfoModal-D5M7-4V3.css","assets/ModelInfoModal-legacy-B8eZaglH.js","assets/ModelsPage-D1GTiXhq.js","assets/ModelsPage-RUhvkx5U.css","assets/ModelsPage-legacy-BYF2vyNR.js","assets/PresetsPage-CWy3_oqr.js","assets/PresetsPage-DH4VfyAq.css","assets/PresetsPage-legacy-OWQcDF2N.js","assets/ProgressPair-ClUie7sd.js","assets/ProgressPair-legacy-1J4x6xOj.js","assets/RegionModal-DuOSjq-F.js","assets/RegionModal-LdlR1j-z.css","assets/RegionModal-legacy-DS7aC_ph.js","assets/Section-legacy-DxXbpDg2.js","assets/Section-ovH48Wsr.js","assets/SegmentModal-DtyvnY3a.js","assets/SegmentModal-legacy-BYEJmEDf.js","assets/SegmentModal-tsdFEX1n.css","assets/SegmentedControl-Bql2PRMp.js","assets/SegmentedControl-legacy-OVWoFH5q.js","assets/ServerPage-BSgkuVoi.css","assets/ServerPage-BcbfDksl.js","assets/ServerPage-legacy-BedTvzgR.js","assets/SettingsPage-4m2TSQsW.css","assets/SettingsPage-CVlEasR3.js","assets/SettingsPage-legacy-DFOUL0Y3.js","assets/SettingsTree-DMnGuOx3.js","assets/SettingsTree-W-RSytni.css","assets/SettingsTree-legacy-qsX909gs.js","assets/SimplePage-BM_rYPpN.js","assets/SimplePage-DGwU_rEi.css","assets/SimplePage-legacy-Bo6pUHDs.js","assets/Stats-YK2JPagx.js","assets/Stats-legacy-Bh4qUJ5P.js","assets/UtilitiesPage-BI1I6fHv.js","assets/UtilitiesPage-ctRRiOhb.css","assets/UtilitiesPage-legacy-BagDsJIL.js","assets/adwaita-Btw1E1Fm.css","assets/adwaita-legacy-BTBQMHWc.js","assets/adwaita-light-DHZNUrns.css","assets/adwaita-light-legacy-B2c7e7ko.js","assets/autumn-CxwCrfcU.css","assets/autumn-legacy-B-v_ANQs.js","assets/catppuccin-frappe-LaPd0kQJ.css","assets/catppuccin-frappe-legacy-CmBlo1sw.js","assets/catppuccin-latte-Cli-azXZ.css","assets/catppuccin-latte-legacy-PmjU5gFL.js","assets/catppuccin-macchiato-CcywAXA5.css","assets/catppuccin-macchiato-legacy-HOwcKsPW.js","assets/catppuccin-mocha-HkpUYVz-.css","assets/catppuccin-mocha-legacy-C4XrVgxq.js","assets/civitai-CewTllLV.js","assets/civitai-legacy-CwEMS1na.js","assets/editor.svelte-legacy-Ck65hZ0e.js","assets/editor.svelte-vWUDahE8.js","assets/gruvbox-dark-B4JFPndM.css","assets/gruvbox-dark-legacy-yhT8FmHh.js","assets/gruvbox-light-WGjO-lel.css","assets/gruvbox-light-legacy-BdmQGDeZ.js","assets/high-contrast-DRr3OSLd.css","assets/high-contrast-legacy-E8XzU9Ns.js","assets/index-CGlmfw74.js","assets/index-DNmvBEqB.css","assets/index-legacy-CyPWMAQS.js","assets/light-Cyy_2RWy.css","assets/light-legacy-CQRR3kO_.js","assets/list-checks-DtEiFdNO.js","assets/list-checks-legacy-ujqw017H.js","assets/one-dark-DUjndS7S.css","assets/one-dark-legacy-D37BLupw.js","assets/oreui-BZqoJIRa.css","assets/oreui-legacy-jcyeu0YY.js","assets/pencil-D3CggFFu.js","assets/pencil-legacy-Bxu5M4Q4.js","assets/polyfills-legacy-BnbJISKd.js","assets/refresh-cw-B9Fvotp7.js","assets/refresh-cw-legacy-OumWT-Yl.js","assets/rose-pine-CgK_txwe.css","assets/rose-pine-dawn-C7iR_R1x.css","assets/rose-pine-dawn-legacy-CUQzOHzw.js","assets/rose-pine-legacy-D2rpCA-y.js","assets/rose-pine-moon-B7rgaEQ4.css","assets/rose-pine-moon-legacy-BaHCUz_K.js","assets/rotate-ccw-clock-DbL5ZE2W.js","assets/rotate-ccw-clock-legacy-BRVtSzcI.js","assets/sliders-horizontal-DhBH7uJG.js","assets/sliders-horizontal-legacy-DB_OJCYv.js","assets/square-dashed-NVFr-DfC.js","assets/square-dashed-legacy-_U9Xf9FX.js","assets/text-BibRY1hW.js","assets/text-legacy-Iph0-CzC.js","assets/vapor-CLyhF96a.css","assets/vapor-legacy-Dr4ENx3j.js","assets/vgui2-ZZoTd9ef.css","assets/vgui2-legacy-XHd-RJ_F.js","icon.svg","manifest.webmanifest","pwa-192.png"], BASE = new URL("./", self.location);
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
