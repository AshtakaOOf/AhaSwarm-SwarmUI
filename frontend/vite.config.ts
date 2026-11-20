import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import legacy from '@vitejs/plugin-legacy';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

function gitCommit(): string {
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    try {
        return execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8' }).trim();
    } catch {
        return 'unknown';
    }
}

function pkgVersion(): string {
    return JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')).version;
}

const devPort = 5173;

const SW_SKIP = new Set(['sw.js', 'index.html', 'pwa-512.png', 'pwa-maskable-512.png', 'apple-touch-icon.png']);
const walk = (d: string, p = ''): string[] => readdirSync(d).flatMap((f) => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`, `${p}${p ? '/' : ''}${f}`) : [`${p}${p ? '/' : ''}${f}`]));

function writeSw(outDir: string) {
    const files = walk(outDir).filter((f) => !SW_SKIP.has(f));
    const h = createHash('sha256');
    for (const f of [...files, 'index.html'].sort()) {
        h.update(f).update(readFileSync(`${outDir}/${f}`));
    }
    const src = readFileSync(fileURLToPath(new URL('./pwa/sw.js', import.meta.url)), 'utf8')
        .replace('__VERSION__', h.digest('hex').slice(0, 12))
        .replace('__ASSETS__', JSON.stringify(files.sort()));
    writeFileSync(`${outDir}/sw.js`, src);
}

const DEV_SW = `self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
`;

function pwa(): Plugin {
    let outDir = '';
    return {
        name: 'aha-pwa',
        configResolved(c) {
            outDir = c.build.outDir;
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = (req.url ?? '').split('?')[0];
                if (url === '/Ahadev/sw.js') {
                    res.setHeader('Content-Type', 'application/javascript');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.end(DEV_SW);
                    return;
                }
                next();
            });
        },
        closeBundle() {
            if (outDir) {
                writeSw(outDir);
            }
        },
    };
}


// the extension serves whichever of Assets/app/dist and Assets/app/dev has the newer build time
function buildTime(): Plugin {
    const time = `${Math.floor(Date.now() / 1000)}`;
    return {
        name: 'aha-build-time',
        apply: 'build',
        transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'aha-build-time', content: time }, injectTo: 'head-prepend' }],
    };
}

export default defineConfig(({ mode }) => ({
    base: mode === 'development' ? '/Ahadev/' : './',
    resolve: {
        alias: {
            $ahakit: fileURLToPath(new URL('./src/lib/ahakit', import.meta.url)),
            $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
        },
    },
    define: { __AHA_COMMIT__: JSON.stringify(gitCommit()), __AHA_VERSION__: JSON.stringify(pkgVersion()) },
    plugins: [
        svelte(),
        buildTime(),
        pwa(),
        tailwindcss(),
        legacy({
            // older mobile browsers get a transpiled + polyfilled SystemJS bundle via <script nomodule>
            targets: ['defaults', 'iOS >= 12', 'Safari >= 12', 'Chrome >= 64', 'Firefox >= 68', 'Samsung >= 9'],
        }),
    ],
    build: {
        // `npm run build:dist` (the GitHub Action) writes the tracked build, plain `npm run build` the ignored local one
        outDir: mode === 'dist' ? '../Assets/app/dist' : '../Assets/app/dev',
        emptyOutDir: true,
        assetsDir: 'assets',
        sourcemap: false,
    },
    server: {
        port: devPort,
        strictPort: true,
        cors: true,
        hmr: { path: '/Ahadev/', clientPort: devPort },
        // `npm run dev` proxies API + image calls to a running SwarmUI (default port 7801)
        proxy: Object.fromEntries(['/API', '/View', '/Output', '/ViewSpecial', '/Text2Image', '/Login', '/GoogleOAuthVerify', '/imgs', '/Audio', '/ExtensionFile']
            .map(p => [p, { target: process.env.SWARM_URL || 'http://127.0.0.1:7801', changeOrigin: true, ws: p === '/API' }])),
    },
}));
