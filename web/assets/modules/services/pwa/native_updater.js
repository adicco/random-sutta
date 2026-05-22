// Path: web/assets/modules/services/pwa/native_updater.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("NativeUpdater");

/**
 * NativeUpdater handles OTA (Over-The-Air) updates for Capacitor apps.
 * It checks for updates from a hosted JSON file and uses capacitor-updater to apply them.
 */
export const NativeUpdater = {
    // URL to your version manifest on GitHub Pages
    MANIFEST_URL: "https://vjjda.github.io/random-sutta/native_version.json",

    async init() {
        // Only run on native platforms (Android/iOS)
        if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
            return;
        }

        try {
            const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
            
            // Notify the native side that the JS bundle has loaded successfully.
            // This prevents auto-rollback if a bad update is deployed.
            await CapacitorUpdater.notifyAppReady();
            logger.info("Init", "Capacitor Updater ready.");

            // Check for updates after a short delay to not block startup
            setTimeout(() => this.checkForUpdates(), 5000);
        } catch (e) {
            logger.warn("Init", "Capacitor Updater plugin not available.");
        }
    },

    async checkForUpdates() {
        try {
            const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
            
            logger.info("Check", "Checking for native updates...");
            
            // 1. Fetch manifest from GitHub Pages
            const response = await fetch(`${this.MANIFEST_URL}?t=${Date.now()}`);
            if (!response.ok) throw new Error("Failed to fetch update manifest");
            
            const manifest = await response.json();
            // Expected manifest: { version: "1.2.3", url: "https://.../dist.zip" }
            
            // 2. Get current version from the plugin
            const current = await CapacitorUpdater.current();
            const currentVersion = current.bundle?.version || "0.0.0";
            
            logger.info("Check", `Current: ${currentVersion}, Latest: ${manifest.version}`);

            if (this._isNewer(manifest.version, currentVersion)) {
                this._showUpdatePrompt(manifest, CapacitorUpdater);
            }
        } catch (e) {
            logger.error("Check", "Update check failed", e);
        }
    },

    /**
     * Shows a prompt to the user when a native update is available.
     */
    _showUpdatePrompt(manifest, plugin) {
        // Reuse PWA Toast styling or create a simple confirm
        if (confirm(`New App Update Available (v${manifest.version})\n\nWould you like to download and apply the update now? The app will restart.`)) {
            this._performUpdate(manifest, plugin);
        }
    },

    async _performUpdate(manifest, plugin) {
        try {
            logger.info("Update", "Downloading update...");
            
            // 1. Download the zip
            const bundle = await plugin.download({
                url: manifest.url,
                version: manifest.version,
            });

            logger.info("Update", "Applying update...");
            
            // 2. Set the new bundle as active
            await plugin.set(bundle);
            
            // App will reload automatically with the new bundle
        } catch (e) {
            logger.error("Update", "Failed to apply update", e);
            alert("Update failed. Please try again later or reinstall the app.");
        }
    },

    /**
     * Simple semver comparison (v1.2.3 > 1.2.2)
     */
    _isNewer(latest, current) {
        const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
        const l = parse(latest);
        const c = parse(current);
        
        for (let i = 0; i < 3; i++) {
            if ((l[i] || 0) > (c[i] || 0)) return true;
            if ((l[i] || 0) < (c[i] || 0)) return false;
        }
        return false;
    }
};
