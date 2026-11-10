import { swarmRoot } from './client';

let doc: Promise<Document> | null = null;
export function classicDoc(refresh = false): Promise<Document> {
    if (!doc || refresh) {
        doc = fetch(`${swarmRoot}Text2Image`, { credentials: 'include' }).then(async r => {
            if (!r.ok) throw new Error(`The classic page ${swarmRoot}Text2Image answered HTTP ${r.status}${r.status === 404 ? ' (not found: is AhaSwarm opened through a server or proxy that only forwards /API?)' : ''}.`);
            const d = new DOMParser().parseFromString(await r.text(), 'text/html');
            if (!d.getElementById('server_tab')) throw new Error('The classic page did not render (signed out, or the server is not installed yet).');
            return d;
        });
        doc.catch(() => (doc = null));
    }
    return doc;
}
