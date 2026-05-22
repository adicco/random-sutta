import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';

// --- HỆ THỐNG COMPILER HTML (Hỗ trợ Partials) ---
const expandHtmlContent = (content, baseDir) => {
    const includeRegex = /<include\s+src=["'](.*?)["']\s*\/?>(?:<\/include>)?/g;
    return content.replace(includeRegex, (match, src) => {
        const filePath = path.resolve(baseDir, src);
        if (!fs.existsSync(filePath)) return `<!-- ERROR: ${filePath} not found -->`;
        const childContent = fs.readFileSync(filePath, 'utf-8');
        return expandHtmlContent(childContent, path.dirname(filePath)); // Đệ quy chèn các partials
    });
};

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
    
    // APK_BUILD/CAPACITOR_BUILD is set in Makefile, TAURI_ENV_PLATFORM is set by Tauri
    const isNative = process.env.APK_BUILD === 'true' || 
                     process.env.CAPACITOR_BUILD === 'true' ||
                     !!process.env.TAURI_ENV_PLATFORM;
    
    // GitHub Pages needs '/random-sutta/', but APK/Tauri needs './'
    // Dev mode usually works best with '/'
    const base = isNative ? './' : (isProd ? '/random-sutta/' : '/');

    return {
        root: 'web', 
        base: base,
        
        esbuild: {
            drop: isProd ? ['debugger', 'console'] : [],
            legalComments: 'none', 
        },

        define: {
            __APP_VERSION__: JSON.stringify(buildVersion),
        },

        build: {
            outDir: '../dist/web', 
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
                name: 'html-compiler',
                transformIndexHtml: {
                    order: 'pre',
                    handler(html) {
                        const expanded = expandHtmlContent(html, path.resolve('web'));
                        return expanded.replace(/__APP_VERSION__/g, buildVersion);
                    }
                },
                configureServer(server) {
                    // Watch for changes in partials
                    server.watcher.add(path.resolve('web/partials/*.html'));
                    server.watcher.on('change', (file) => {
                        if (file.includes('web/partials')) {
                            server.ws.send({ type: 'full-reload' });
                        }
                    });
                }
            },
            // [FIX] Only enable PWA for Web builds, disable for Native
            VitePWA({
                disable: isNative,
                registerType: 'prompt', // [CHANGED] From autoUpdate to prompt
                injectRegister: null, // [CHANGED] From inline to null (we handle it in pwa_manager.js)
                includeManifestIcons: false, 
                manifestFilename: 'manifest.json',
                devOptions: {
                    enabled: false
                },
                manifest: {
                    id: 'com.randomsutta.app',
                    name: 'Random Sutta',
                    short_name: 'Random Sutta',
                    description: 'Discover the Wisdom of the Buddha',
                    theme_color: '#8b4513',
                    background_color: '#fdfbf7',
                    display: 'standalone', 
                    orientation: 'portrait',
                    start_url: base + '?utm_source=pwa', 
                    scope: base,
                    icons: [
                        { 
                            src: 'assets/icons/web-app-manifest-192x192.png', 
                            sizes: '192x192', 
                            type: 'image/png',
                            purpose: 'any' 
                        },
                        { 
                            src: 'assets/icons/web-app-manifest-192x192.png', 
                            sizes: '192x192', 
                            type: 'image/png',
                            purpose: 'maskable' 
                        },
                        { 
                            src: 'assets/icons/web-app-manifest-512x512.png', 
                            sizes: '512x512', 
                            type: 'image/png',
                            purpose: 'any'
                        },
                        { 
                            src: 'assets/icons/web-app-manifest-512x512.png', 
                            sizes: '512x512', 
                            type: 'image/png',
                            purpose: 'maskable'
                        },
                        { 
                            src: 'assets/icons/apple-touch-icon.png', 
                            sizes: '180x180', 
                            type: 'image/png' 
                        }
                    ]
                },
                workbox: {
                    skipWaiting: true,
                    clientsClaim: true,
                    cleanupOutdatedCaches: true,
                    directoryIndex: 'index.html',
                    navigateFallback: base + 'index.html', 
                    globPatterns: isProd ? ['**/*.{js,css,html,ico,png,svg,woff2,wasm,json}'] : [],
                    globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js', 'manifest.json'], 
                    maximumFileSizeToCacheInBytes: 50 * 1024 * 1024, 
                    runtimeCaching: [
                        {                            
                            // [CRITICAL] Sutta Databases (Core + Shards) - Supports .db and .db.gz
                            urlPattern: ({ url }) => url.pathname.includes('/assets/db/sutta_') && (url.pathname.endsWith('.db') || url.pathname.endsWith('.gz')),
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'sutta-database-cache',
                                expiration: {
                                    maxEntries: 20,
                                    maxAgeSeconds: 60 * 60 * 24 * 365,
                                },
                                cacheableResponse: {
                                    statuses: [0, 200],
                                },
                            },
                        },
                        {
                            // Dictionary Databases - Supports .db and .db.gz
                            urlPattern: ({ url }) => url.pathname.includes('/assets/db/dictionaries/') && (url.pathname.endsWith('.db') || url.pathname.endsWith('.gz')),
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'dictionary-cache',
                                expiration: {
                                    maxEntries: 10,
                                    maxAgeSeconds: 60 * 60 * 24 * 365,
                                },
                                cacheableResponse: {
                                    statuses: [0, 200],
                                },
                            },
                        }
                    ]
                }
            })
        ]
    };
});
