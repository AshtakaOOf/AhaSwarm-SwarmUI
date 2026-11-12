import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import legacy from '@vitejs/plugin-legacy';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

function gitCommit(): string {
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    const git = (args: string) => execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();
    try {
        return `${git('rev-parse --short HEAD')}-${git('rev-list --count HEAD')}`;
    } catch {
        return 'unknown';
    }
}

const devPort = 5173;

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
    define: { __AHA_COMMIT__: JSON.stringify(gitCommit()) },
    plugins: [
        svelte(),
        buildTime(),
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
        proxy: Object.fromEntries(['/API', '/View', '/Output', '/ViewSpecial', '/Text2Image', '/Login', '/imgs', '/Audio', '/ExtensionFile']
            .map(p => [p, { target: process.env.SWARM_URL || 'http://127.0.0.1:7801', changeOrigin: true, ws: p === '/API' }])),
    },
}));
