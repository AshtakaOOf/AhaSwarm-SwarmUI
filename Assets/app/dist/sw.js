const C = "shell-13fce8257a9f", ASSETS = ["assets/BatchTool-CIq4-XDb.js","assets/BatchTool-legacy-CtzbCNKc.js","assets/ComfyTool--f10ibUn.js","assets/ComfyTool-Bmku3by6.css","assets/ComfyTool-legacy-DvWECqlu.js","assets/Grid-AN7Q5ShW.js","assets/Grid-legacy-ut29XDkC.js","assets/GridTool-C2t0AqaE.css","assets/GridTool-DKaZp_jO.js","assets/GridTool-legacy-Cz-NVLf-.js","assets/ImageEditor-BRJZE1zS.css","assets/ImageEditor-BpQg7JYo.js","assets/ImageEditor-legacy-JonKeGem.js","assets/ModelInfoModal-D5M7-4V3.css","assets/ModelInfoModal-Dp2U7su8.js","assets/ModelInfoModal-legacy-jWaeU9VB.js","assets/ModelsPage-DaplzrW5.js","assets/ModelsPage-RUhvkx5U.css","assets/ModelsPage-legacy-CFcBi26S.js","assets/PresetsPage-BrpUuxFT.js","assets/PresetsPage-legacy-bFesMSJJ.js","assets/PresetsPage-vcAsoPKS.css","assets/ProgressPair-Cd82QF4e.js","assets/ProgressPair-legacy-9Zn4VRqD.js","assets/RegionModal-CSPMTZv1.js","assets/RegionModal-LdlR1j-z.css","assets/RegionModal-legacy-Cg-eyhT5.js","assets/Section-BCa7ijhN.js","assets/Section-legacy-CtcanSyb.js","assets/SegmentModal-3542fcbh.js","assets/SegmentModal-legacy-DGVXpJDi.js","assets/SegmentModal-tsdFEX1n.css","assets/SegmentedControl-Ib6GX7zi.js","assets/SegmentedControl-legacy-BsGYIuMz.js","assets/ServerPage-BSgkuVoi.css","assets/ServerPage-Ww2ChDse.js","assets/ServerPage-legacy-BY7_ZrSh.js","assets/SettingsPage-4m2TSQsW.css","assets/SettingsPage-DMvMZBb3.js","assets/SettingsPage-legacy-DTIQuOUh.js","assets/SettingsTree-BDndXHvf.js","assets/SettingsTree-W-RSytni.css","assets/SettingsTree-legacy-Dec5r-rd.js","assets/SimplePage-DF6b5vm1.js","assets/SimplePage-DGwU_rEi.css","assets/SimplePage-legacy-eyqURKY5.js","assets/Stats-Bh2oTIDu.js","assets/Stats-legacy-DN9SD-bX.js","assets/UtilitiesPage-DMsADzKM.js","assets/UtilitiesPage-ctRRiOhb.css","assets/UtilitiesPage-legacy-DzfYr4-w.js","assets/adwaita-Btw1E1Fm.css","assets/adwaita-legacy-BTBQMHWc.js","assets/adwaita-light-DHZNUrns.css","assets/adwaita-light-legacy-B2c7e7ko.js","assets/autumn-CxwCrfcU.css","assets/autumn-legacy-B-v_ANQs.js","assets/catppuccin-frappe-LaPd0kQJ.css","assets/catppuccin-frappe-legacy-CmBlo1sw.js","assets/catppuccin-latte-Cli-azXZ.css","assets/catppuccin-latte-legacy-PmjU5gFL.js","assets/catppuccin-macchiato-CcywAXA5.css","assets/catppuccin-macchiato-legacy-HOwcKsPW.js","assets/catppuccin-mocha-HkpUYVz-.css","assets/catppuccin-mocha-legacy-C4XrVgxq.js","assets/civitai-JBGkgsAg.js","assets/civitai-legacy-CeE48W0H.js","assets/editor.svelte-Bav9eLGI.js","assets/editor.svelte-legacy-CPfVyt4c.js","assets/gruvbox-dark-B4JFPndM.css","assets/gruvbox-dark-legacy-yhT8FmHh.js","assets/gruvbox-light-WGjO-lel.css","assets/gruvbox-light-legacy-BdmQGDeZ.js","assets/high-contrast-DRr3OSLd.css","assets/high-contrast-legacy-E8XzU9Ns.js","assets/index-CDDiIrjg.js","assets/index-legacy-BHOlieno.js","assets/index-qsJ9Kp9h.css","assets/light-Cyy_2RWy.css","assets/light-legacy-CQRR3kO_.js","assets/list-checks-legacy-GM-1R9uf.js","assets/list-checks-wYw-NgGA.js","assets/one-dark-DUjndS7S.css","assets/one-dark-legacy-D37BLupw.js","assets/oreui-BZqoJIRa.css","assets/oreui-legacy-jcyeu0YY.js","assets/pencil-Cc9bMu0k.js","assets/pencil-legacy-BtaY75H6.js","assets/polyfills-legacy-BnbJISKd.js","assets/refresh-cw-DF1erBhD.js","assets/refresh-cw-legacy-KOGp0HmL.js","assets/rose-pine-CgK_txwe.css","assets/rose-pine-dawn-C7iR_R1x.css","assets/rose-pine-dawn-legacy-CUQzOHzw.js","assets/rose-pine-legacy-D2rpCA-y.js","assets/rose-pine-moon-B7rgaEQ4.css","assets/rose-pine-moon-legacy-BaHCUz_K.js","assets/rotate-ccw-clock-DGkZ6B_N.js","assets/rotate-ccw-clock-legacy-BMvo3T2H.js","assets/sliders-horizontal-CO22kUdM.js","assets/sliders-horizontal-legacy-BtyGBB_q.js","assets/square-dashed-DwOHOPTI.js","assets/square-dashed-legacy-_LXS0A-x.js","assets/text-BibRY1hW.js","assets/text-legacy-Iph0-CzC.js","assets/vapor-CLyhF96a.css","assets/vapor-legacy-Dr4ENx3j.js","assets/vgui2-ZZoTd9ef.css","assets/vgui2-legacy-XHd-RJ_F.js","icon.svg","manifest.webmanifest","pwa-192.png"], BASE = new URL("./", self.location);
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
