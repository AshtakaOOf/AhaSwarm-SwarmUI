const C = "shell-210d838eb6f4", ASSETS = ["assets/BatchTool-BwcbO4BH.js","assets/BatchTool-legacy-DMBygnA4.js","assets/ComfyTool-Bmku3by6.css","assets/ComfyTool-Dzvg9Y76.js","assets/ComfyTool-legacy-CviH_Etm.js","assets/FormRow-SzARbpNw.js","assets/FormRow-legacy-D5UBc4_9.js","assets/Grid-BJ7TZ827.js","assets/Grid-legacy-CNx5JEjn.js","assets/GridTool-C2t0AqaE.css","assets/GridTool-CwR78Of7.js","assets/GridTool-legacy-9SShoOSx.js","assets/ImageEditor-BRJZE1zS.css","assets/ImageEditor-legacy-Brkom1wV.js","assets/ImageEditor-qp7P5KhY.js","assets/ModelInfoModal-CVv7HXOU.js","assets/ModelInfoModal-D5M7-4V3.css","assets/ModelInfoModal-legacy-K4sb55aZ.js","assets/ModelsPage-BH-YjnnI.js","assets/ModelsPage-f52SIKGt.css","assets/ModelsPage-legacy-Dubx1iHu.js","assets/PresetsPage-Cc7X6Akd.js","assets/PresetsPage-DH4VfyAq.css","assets/PresetsPage-legacy-C1vkrEVh.js","assets/ProgressPair-CgUnMcxl.js","assets/ProgressPair-legacy-CYF3eSC-.js","assets/RegionModal-C2UBTQqa.js","assets/RegionModal-LdlR1j-z.css","assets/RegionModal-legacy-0HMNVnYn.js","assets/Section-DOMX17yI.js","assets/Section-legacy-6blejYAi.js","assets/SegmentModal-FJYa0hHY.js","assets/SegmentModal-legacy-mWQTfOgW.js","assets/SegmentModal-tsdFEX1n.css","assets/SegmentedControl-9cpey4g8.js","assets/SegmentedControl-legacy-CFJVF9oE.js","assets/ServerPage-BSgkuVoi.css","assets/ServerPage-DalCKvZN.js","assets/ServerPage-legacy-y0tCGBdS.js","assets/SettingsPage-Cm1v6qeO.css","assets/SettingsPage-Dzjdr6Jr.js","assets/SettingsPage-legacy-BvlCaFRK.js","assets/SettingsTree-W-RSytni.css","assets/SettingsTree-legacy-CZPuNQpT.js","assets/SettingsTree-vGFOh6qe.js","assets/SimplePage-BCzPxwVC.js","assets/SimplePage-DGwU_rEi.css","assets/SimplePage-legacy-BUlH4_U7.js","assets/Stats-fXm_hIdl.js","assets/Stats-legacy-BbeVXrQR.js","assets/UtilitiesPage-Dl_SoIGO.js","assets/UtilitiesPage-ctRRiOhb.css","assets/UtilitiesPage-legacy-Cc2uV_8Z.js","assets/adwaita-Btw1E1Fm.css","assets/adwaita-legacy-BTBQMHWc.js","assets/adwaita-light-DHZNUrns.css","assets/adwaita-light-legacy-B2c7e7ko.js","assets/autumn-CxwCrfcU.css","assets/autumn-legacy-B-v_ANQs.js","assets/catppuccin-frappe-LaPd0kQJ.css","assets/catppuccin-frappe-legacy-CmBlo1sw.js","assets/catppuccin-latte-Cli-azXZ.css","assets/catppuccin-latte-legacy-PmjU5gFL.js","assets/catppuccin-macchiato-CcywAXA5.css","assets/catppuccin-macchiato-legacy-HOwcKsPW.js","assets/catppuccin-mocha-HkpUYVz-.css","assets/catppuccin-mocha-legacy-C4XrVgxq.js","assets/civitai-CFIqV_uy.js","assets/civitai-legacy-oqjoTRDf.js","assets/editor.svelte-O9PPerTv.js","assets/editor.svelte-legacy-CRQbwVi3.js","assets/gruvbox-dark-B4JFPndM.css","assets/gruvbox-dark-legacy-yhT8FmHh.js","assets/gruvbox-light-WGjO-lel.css","assets/gruvbox-light-legacy-BdmQGDeZ.js","assets/high-contrast-DRr3OSLd.css","assets/high-contrast-legacy-E8XzU9Ns.js","assets/index-7JAc2jvr.css","assets/index-CCZjC9HR.js","assets/index-legacy-BOtFtczO.js","assets/light-Cyy_2RWy.css","assets/light-legacy-CQRR3kO_.js","assets/list-checks-DrrmRs4P.js","assets/list-checks-legacy-Cp3C2Z1F.js","assets/one-dark-DUjndS7S.css","assets/one-dark-legacy-D37BLupw.js","assets/oreui-BZqoJIRa.css","assets/oreui-legacy-jcyeu0YY.js","assets/pencil-PNFfPS45.js","assets/pencil-legacy-B8wTtZCr.js","assets/polyfills-legacy-BnbJISKd.js","assets/refresh-cw-9U5cdC6D.js","assets/refresh-cw-legacy-DvyIq4QC.js","assets/rose-pine-CgK_txwe.css","assets/rose-pine-dawn-C7iR_R1x.css","assets/rose-pine-dawn-legacy-CUQzOHzw.js","assets/rose-pine-legacy-D2rpCA-y.js","assets/rose-pine-moon-B7rgaEQ4.css","assets/rose-pine-moon-legacy-BaHCUz_K.js","assets/rotate-ccw-clock-legacy-UbwRVPqG.js","assets/rotate-ccw-clock-pG4eYkch.js","assets/sliders-horizontal-BslFbgGV.js","assets/sliders-horizontal-legacy-3gCT_FOd.js","assets/square-dashed-BcgwUmmF.js","assets/square-dashed-legacy-CYcn8u39.js","assets/text-BibRY1hW.js","assets/text-legacy-Iph0-CzC.js","assets/vapor-CLyhF96a.css","assets/vapor-legacy-Dr4ENx3j.js","assets/vgui2-ZZoTd9ef.css","assets/vgui2-legacy-XHd-RJ_F.js","icon.svg","manifest.webmanifest","pwa-192.png"], BASE = new URL("./", self.location);
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
