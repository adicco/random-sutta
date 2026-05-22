// Path: web/assets/modules/core/app_router.js
import { Router } from "core/router.js";
import { SuttaController } from "core/sutta_controller.js";
import { ViewManager } from "ui/managers/view_manager.js";
import { getLogger } from "utils/logger.js";
import { RandomBuffer } from "services/index.js";
import { SuttaPersistence } from "core/sutta/persistence.js";

const logger = getLogger("AppRouter");

export const AppRouter = {
    init: async function() {
        this.setupPopStateListener();
        this.setupNativeDeepLinks();
        this.setupSyncListener();
        await this.handleInitialRoute();
    },

    handleInitialRoute: async function() {
        const initialParams = Router.getParams();
        const progress = SuttaPersistence.load();
        
        logger.info("handleInitialRoute", "Start", { q: initialParams.q, hasProgress: !!progress });

        if (initialParams.q) {
            await ViewManager.switchView('reader');
            
            let loadId = initialParams.q;
            if (window.location.hash) loadId += window.location.hash;
            
            const options = {};
            if (initialParams.hl) options.hl = initialParams.hl;

            let restoreScroll = 0;
            if (progress && progress.uid === loadId.split('#')[0]) {
                restoreScroll = progress.scrollY;
            }

            await SuttaController.loadSutta(loadId, true, restoreScroll, options);
            RandomBuffer.startBackgroundWork();
        } else {
            // Root access -> Try restore last read or go to Landing
            if (progress && progress.uid) {
                logger.info("handleInitialRoute", `Restoring last read: ${progress.uid}`);
                await ViewManager.switchView('reader');
                
                // [FIX] iOS IPA might need a small tick to ensure DOM is ready after switchView
                await new Promise(r => requestAnimationFrame(r));
                
                try {
                    await SuttaController.loadSutta(progress.uid, true, progress.scrollY);
                } catch (e) {
                    logger.error("handleInitialRoute", "Restoration failed, falling back to landing", e);
                    ViewManager.switchView('landing');
                }
            } else {
                logger.info("handleInitialRoute", "No progress found, showing landing");
                ViewManager.switchView('landing');
            }
            
            RandomBuffer.startBackgroundWork();
        }
    },

    setupSyncListener: function() {
        window.addEventListener("sync-data-applied", () => {
            const currentParams = Router.getParams();
            // Only auto-restore if we are on landing and no query param is present
            if (!currentParams.q && ViewManager.currentView === 'landing') {
                const progress = SuttaPersistence.load();
                if (progress && progress.uid) {
                    logger.info("SyncListener", `Auto-restoring from sync: ${progress.uid}`);
                    this.handleInitialRoute();
                }
            }
        });
    },

    setupPopStateListener: function() {
        window.addEventListener("popstate", (event) => {
            const currentParams = Router.getParams();
            const savedScroll = event.state && event.state.scrollY ? event.state.scrollY : 0;

            if (currentParams.q) {
                ViewManager.switchView('reader');
                let loadId = currentParams.q;
                if (window.location.hash) loadId += window.location.hash;
                
                const options = { transition: false };
                if (currentParams.hl) options.hl = currentParams.hl;

                SuttaController.loadSutta(loadId, false, savedScroll, options);
            } else {
                ViewManager.switchView('landing');
            }
        });
    },

    processDeepLink: async function(urlStr) {
        logger.info("DeepLink", "Processing: " + urlStr);

        try {
            let q = null;
            let hash = "";

            // Attempt 1: Standard URL parsing
            try {
                const url = new URL(urlStr);
                q = url.searchParams.get('q');
                hash = url.hash;
            } catch (e) {}

            // Attempt 2: Manual fallback (resilient to custom scheme parsing quirks)
            if (!q) {
                const qMatch = urlStr.match(/[?&]q=([^&#]+)/);
                if (qMatch) q = decodeURIComponent(qMatch[1]);
                
                const hashMatch = urlStr.match(/#([^?]+)/);
                if (hashMatch) hash = '#' + hashMatch[1];
            }

            if (q) {
                ViewManager.switchView('reader');
                let loadId = q;
                if (hash) loadId += hash;
                
                // Allow a small delay for the view switcher and DB to be ready
                setTimeout(() => {
                    SuttaController.loadSutta(loadId, true);
                }, 100);
            }
        } catch (e) {
            logger.error("DeepLink", "Failed to parse app URL: " + urlStr, e);
        }
    },

    setupNativeDeepLinks: function() {
        // Capacitor App Links
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            import('@capacitor/app').then(({ App }) => {
                App.addListener('appUrlOpen', async data => {
                    this.processDeepLink(data.url);
                });
            }).catch(e => logger.warn("AppRouter", "Failed to load Capacitor App plugin", e));
        }

        // Tauri Deep Links
        if (window.__TAURI_INTERNALS__) {
            import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
                onOpenUrl(async (urls) => {
                    logger.info("Tauri App", "Tauri deep link opened: " + JSON.stringify(urls));
                    for (const urlStr of urls) {
                        this.processDeepLink(urlStr);
                    }
                });
            }).catch(e => logger.warn("AppRouter", "Failed to load Tauri Deep Link plugin", e));
        }
    }
};
