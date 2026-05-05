// Path: web/assets/modules/services/sync/sync_orchestrator.js
import { getLogger } from "utils/logger.js";
import { GoogleAuthManager } from "services/sync/google_auth_manager.js";
import { GoogleDriveSync } from "services/sync/google_drive_sync.js";

const logger = getLogger("SyncOrchestrator");

export const SyncOrchestrator = {
    SYNC_KEYS: ["sutta_bookmarks", "sutta_history", "last_read_sutta", "tts_auto_next", "tts_playback_mode", "tts_active_engine", "tts_rate", "tts_pitch", "tts_voice_uri"],
    DEBOUNCE_MS: 5000,
    debounceTimer: null,
    isSyncing: false,

    init() {
        GoogleAuthManager.init();
        
        // Listen for Auth Success
        window.addEventListener("google-auth-success", () => {
            this.autoSync();
        });

        // Listen for Local Changes
        window.addEventListener("local-data-changed", () => {
            localStorage.setItem("sync_local_update_timestamp", Date.now().toString());
            if (GoogleAuthManager.isAuthenticated()) {
                this.scheduleAutoPush();
            }
        });

        // Initial Sync if already authenticated
        if (GoogleAuthManager.isAuthenticated()) {
            this.autoSync();
        }
    },

    async autoSync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        window.dispatchEvent(new CustomEvent("sync-start"));
        logger.info("AutoSync", "Starting auto-sync...");
        
        try {
            const cloudData = await GoogleDriveSync.downloadData();
            if (cloudData) {
                this.smartMerge(cloudData);
                logger.info("AutoSync", "Pull and merge completed");
            } else {
                logger.info("AutoSync", "No cloud data found. Preparing first push.");
                await this.forcePush();
            }
            window.dispatchEvent(new CustomEvent("sync-end"));
        } catch (e) {
            logger.error("AutoSync", e);
            window.dispatchEvent(new CustomEvent("sync-error"));
        } finally {
            this.isSyncing = false;
        }
    },

    scheduleAutoPush() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.autoPush();
        }, this.DEBOUNCE_MS);
    },

    async autoPush() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        window.dispatchEvent(new CustomEvent("sync-start"));
        try {
            const localData = this.packData();
            await GoogleDriveSync.uploadData(localData);
            logger.info("AutoPush", "Success");
            window.dispatchEvent(new CustomEvent("sync-end"));
        } catch (e) {
            logger.error("AutoPush", e);
            window.dispatchEvent(new CustomEvent("sync-error"));
        } finally {
            this.isSyncing = false;
        }
    },

    packData() {
        const data = {
            version: 1,
            timestamp: Date.now(),
            payload: {}
        };
        this.SYNC_KEYS.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                try {
                    data.payload[key] = JSON.parse(value);
                } catch {
                    data.payload[key] = value;
                }
            }
        });
        return data;
    },

    unpackAndApply(cloudData) {
        if (!cloudData || !cloudData.payload) return;
        
        Object.entries(cloudData.payload).forEach(([key, value]) => {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
            localStorage.setItem(key, stringValue);
        });
        
        // Notify app to refresh UI
        window.dispatchEvent(new CustomEvent("sync-data-applied"));
    },

    smartMerge(cloudData) {
        if (!cloudData || !cloudData.payload) return;
        
        const localData = this.packData();
        const mergedPayload = { ...localData.payload };
        const localUpdateTimestamp = parseInt(localStorage.getItem("sync_local_update_timestamp") || "0", 10);

        // Special logic for bookmarks (Array merge)
        if (cloudData.payload.sutta_bookmarks && Array.isArray(cloudData.payload.sutta_bookmarks)) {
            const localBookmarks = localData.payload.sutta_bookmarks || [];
            const cloudBookmarks = cloudData.payload.sutta_bookmarks;
            
            // Map by ID and take latest timestamp
            const bookmarkMap = new Map();
            [...localBookmarks, ...cloudBookmarks].forEach(b => {
                const existing = bookmarkMap.get(b.id);
                if (!existing || b.timestamp > existing.timestamp) {
                    bookmarkMap.set(b.id, b);
                }
            });
            mergedPayload.sutta_bookmarks = Array.from(bookmarkMap.values());
        }

        // Special logic for history (Object merge by ID)
        if (cloudData.payload.sutta_history && typeof cloudData.payload.sutta_history === 'object') {
            const localHistory = localData.payload.sutta_history || {};
            const cloudHistory = cloudData.payload.sutta_history;
            const mergedHistory = { ...localHistory };
            
            Object.keys(cloudHistory).forEach(id => {
                if (!mergedHistory[id] || cloudHistory[id].timestamp > mergedHistory[id].timestamp) {
                    mergedHistory[id] = cloudHistory[id];
                }
            });
            mergedPayload.sutta_history = mergedHistory;
        }

        // For other keys, if not present in local or cloud is newer (overall)
        Object.entries(cloudData.payload).forEach(([key, value]) => {
            if (key === "sutta_bookmarks" || key === "sutta_history") return; // Already handled
            
            // If local doesn't have it, or cloud data is newer than the last local update
            if (!mergedPayload[key] || cloudData.timestamp > localUpdateTimestamp) {
                mergedPayload[key] = value;
            }
        });

        // Apply back
        this.unpackAndApply({ payload: mergedPayload });
        
        // Push merged back to cloud if it changed something
        this.autoPush();
    },

    async forcePush() {
        logger.info("ForcePush", "Overwriting cloud with local data...");
        const localData = this.packData();
        await GoogleDriveSync.uploadData(localData);
        logger.info("ForcePush", "Done");
    },

    async forcePull() {
        logger.info("ForcePull", "Overwriting local with cloud data...");
        const cloudData = await GoogleDriveSync.downloadData();
        if (cloudData) {
            this.unpackAndApply(cloudData);
            logger.info("ForcePull", "Done");
        } else {
            logger.warn("ForcePull", "No cloud data to pull");
        }
    }
};