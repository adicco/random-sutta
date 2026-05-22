// Path: web/assets/modules/services/pwa/pwa_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("PWAManager");

/**
 * PWAManager handles Service Worker registration and update notifications.
 * It works with vite-plugin-pwa in 'prompt' mode.
 */
export const PWAManager = {
    init() {
        // Skip for native platforms or file protocol
        if (window.Capacitor?.isNativePlatform() || window.location.protocol === 'file:') {
            return;
        }

        this._setupRegistration();
    },

    async _setupRegistration() {
        if (!('serviceWorker' in navigator)) return;

        try {
            // We use virtual module provided by vite-plugin-pwa
            // In dev mode, this might fail, so we wrap in try-catch
            const { registerSW } = await import('virtual:pwa-register');
            
            const updateSW = registerSW({
                onNeedRefresh: () => {
                    logger.info("Update", "New content available! Prompting user...");
                    this._showUpdateToast(updateSW);
                },
                onOfflineReady: () => {
                    logger.info("PWA", "App ready for offline use.");
                },
                onRegisterError: (error) => {
                    logger.error("PWA", "Service Worker registration failed", error);
                }
            });
        } catch (e) {
            logger.debug("PWA", "virtual:pwa-register not available (expected in dev or non-pwa builds)");
        }
    },

    /**
     * Shows a non-intrusive toast notification for app updates.
     */
    _showUpdateToast(updateSW) {
        // Create toast element
        const toast = document.createElement('div');
        toast.id = 'pwa-update-toast';
        toast.innerHTML = `
            <div class="pwa-toast-content">
                <div class="pwa-toast-text">
                    <strong>Update Available</strong>
                    <p>New version is ready to install.</p>
                </div>
                <div class="pwa-toast-actions">
                    <button id="pwa-update-refresh" class="pwa-btn-primary">Update</button>
                    <button id="pwa-update-close" class="pwa-btn-ghost">Later</button>
                </div>
            </div>
        `;

        document.body.appendChild(toast);

        // Bind actions
        document.getElementById('pwa-update-refresh').addEventListener('click', () => {
            logger.info("Update", "User accepted update. Refreshing...");
            updateSW(true);
        });

        document.getElementById('pwa-update-close').addEventListener('click', () => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        });

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });
    }
};
