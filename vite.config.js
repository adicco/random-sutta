import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';

// --- HỆ THỐNG AUTO-ALIAS TỰ ĐỘNG ---
function getDirectories(source) {
    if (!fs.existsSync(source)) return [];
    return fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

const aliases = {};
// Bỏ qua prefix __dirname vì ta có thể dùng path.resolve('.')
const rootDir = path.resolve('.');
const webDir = path.resolve(rootDir, 'web');
const modulesDir = path.resolve(rootDir, 'web/assets/modules');

getDirectories(webDir).forEach(dir => {
    if (dir !== 'assets') { 
        aliases[dir] = path.resolve(webDir, dir);
    }
});

if (fs.existsSync(modulesDir)) {
    getDirectories(modulesDir).forEach(dir => {
        // Tương đương với importmap hiện tại: "core/": "./assets/modules/core/"
        // Vite cho phép alias dạng 'core/' hoặc 'core'
        aliases[`${dir}/`] = path.resolve(modulesDir, dir) + '/';
        aliases[`${dir}`] = path.resolve(modulesDir, dir);
    });
}
// -----------------------------------
aliases['libs'] = path.resolve(webDir, 'assets/libs');
// Map wa-sqlite cho giống importmap cũ
aliases['wa-sqlite'] = path.resolve(webDir, 'assets/libs');

const buildVersion = new Date().getTime();

export default defineConfig(({ mode }) => {
    const isProd = mode === 'production';

    return {
        root: 'web', 
        base: './', // Sử dụng relative path để hỗ trợ mở file trực tiếp (nếu được) hoặc deploy github pages
        
        esbuild: {
            drop: isProd ? ['debugger', 'console'] : [],
            legalComments: 'none', 
        },

        define: {
            __APP_VERSION__: JSON.stringify(buildVersion),
        },

        build: {
            outDir: '../dist', 
            emptyOutDir: true,
            target: 'es2022', 
            minify: 'esbuild',
            cssMinify: true,
            sourcemap: !isProd,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('wa-sqlite')) {
                            return 'vendor-sqlite';
                        }
                        if (id.includes('node_modules')) {
                            return 'vendor';
                        }
                    },
                    entryFileNames: 'assets/[name].[hash].js',
                    chunkFileNames: 'assets/[name].[hash].js',
                    assetFileNames: 'assets/[name].[hash].[ext]'
                }
            }
        },
        css: {
            devSourcemap: true, 
        },
        resolve: {
            alias: aliases,
        },
        plugins: [
            basicSsl(),
            {
                name: 'html-transform',
                transformIndexHtml(html) {
                    return html.replace(/__APP_VERSION__/g, buildVersion);
                }
            },
            VitePWA({
                registerType: 'prompt',
                includeManifestIcons: false, 
                manifest: {
                    name: 'Random Sutta',
                    short_name: 'Random Sutta',
                    description: 'Discover the Wisdom of the Buddha',
                    theme_color: '#fdfbf7',
                    background_color: '#fdfbf7',
                    display: 'standalone', 
                    orientation: 'portrait',
                    scope: '/',
                    start_url: '/',
                    icons: [
                        { src: 'assets/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
                        { src: 'assets/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
                        { src: 'assets/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
                        { src: 'assets/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
                    ]
                },
                workbox: {
                    cleanupOutdatedCaches: true,
                    navigateFallback: 'index.html',
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,json}'], 
                    globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js', '**/*.db', '**/*.zip'],
                    maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // Tăng lên 15MB cho chắc
                    runtimeCaching: [
                        // Caching logic tương tự
                    ]
                }
            })
        ]
    };
});
