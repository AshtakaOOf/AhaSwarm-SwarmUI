import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import legacy from '@vitejs/plugin-legacy';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

function gitCommit(): string {
    try {
        return execSync('git rev-parse --short HEAD', {
            cwd: fileURLToPath(new URL('..', import.meta.url)),
            encoding: 'utf8',
        }).trim();
    } catch {
        return 'unknown';
    }
}

const devPort = 5173;

export default defineConfig(({ mode }) => ({
    base: mode === 'development' ? '/Ahadev/' : './',
    resolve: {
        alias: {
            $ahakit: fileURLToPath(new URL('./src/lib/ahakit', import.meta.url)),
            $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
        },
    },
    define: { __AHA_COMMIT__: JSON.stringify(gitCommit()) },
    plugins: [
        svelte(),
        tailwindcss(),
        legacy({
            // older mobile browsers get a transpiled + polyfilled SystemJS bundle via <script nomodule>
            targets: ['defaults', 'iOS >= 12', 'Safari >= 12', 'Chrome >= 64', 'Firefox >= 68', 'Samsung >= 9'],
        }),
    ],
    build: {
        outDir: '../Assets/app',
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
        proxy: Object.fromEntries(['/API', '/View', '/Output', '/ViewSpecial', '/Text2Image', '/Login', '/imgs', '/Audio', '/ExtensionFile']
            .map(p => [p, { target: process.env.SWARM_URL || 'http://127.0.0.1:7801', changeOrigin: true, ws: p === '/API' }])),
    },
}));
