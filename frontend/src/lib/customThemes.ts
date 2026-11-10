import { registerCustomTheme } from '$ahakit';

function loadCustomThemes() {
    const el = document.getElementById('aha-custom-themes');
    if (!el?.textContent) return;
    try {
        const list = JSON.parse(el.textContent) as { id: string; css: string }[];
        for (const t of list) {
            if (!registerCustomTheme(t.id, t.css)) console.warn(`AhaSwarm: custom theme '${t.id}' skipped (invalid id or same id as a bundled theme)`);
        }
    } catch (e) {
        console.warn('AhaSwarm: could not read the custom themes', e);
    }
}

loadCustomThemes();
