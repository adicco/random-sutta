// Path: web/assets/modules/services/sync/sync_orchestrator.js
import { getLogger } from "utils/logger.js";
import { GithubAuthManager } from "services/sync/github_auth_manager.js";
import { GithubSync } from "services/sync/github_sync.js";
import { SyncUnificationUI } from "ui/managers/sync_unification_ui.js";

const logger = getLogger("SyncOrchestrator");

export const SyncOrchestrator = {
    SYNC_KEYS: ["sutta_bookmarks", "sutta_history", "last_read_sutta", "tts_auto_next", "tts_playback_mode", "tts_active_engine", "tts_rate", "tts_pitch", "tts_voice_uri"],
    DEBOUNCE_MS: 5000,
    debounceTimer: null,
    isSyncing: false,

    init() {
        GithubAuthManager.init();
        
        // Listen for Auth Success
        window.addEventListener("github-auth-success", () => {
            this.autoSync();
        });

        // Listen for Local Changes
        window.addEventListener("local-data-changed", () => {
            localStorage.setItem("sync_local_update_timestamp", Date.now().toString());
            if (GithubAuthManager.isAuthenticated()) {
                this.scheduleAutoPush();
            }
        });

        // Initial Sync if already authenticated
        if (GithubAuthManager.isAuthenticated()) {
            this.autoSync();
        }
    },

    async autoSync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        window.dispatchEvent(new CustomEvent("sync-start"));
        logger.info("AutoSync", "Starting auto-sync...");
        
        try {
            const cloudResult = await GithubSync.downloadData();
            const localSha = localStorage.getItem("sync_github_sha");
            const localUpdateTimestamp = parseInt(localStorage.getItem("sync_local_update_timestamp") || "0", 10);
            const lastSyncTimestamp = parseInt(localStorage.getItem("sync_last_success_timestamp") || "0", 10);

            if (cloudResult) {
                const { data: cloudData, sha: cloudSha } = cloudResult;
                
                if (cloudSha === localSha) {
                    logger.info("AutoSync", "Cloud is up to date.");
                    if (localUpdateTimestamp > lastSyncTimestamp) {
                        logger.info("AutoSync", "Local changes detected, pushing to cloud.");
                        await this._doPush(cloudSha);
                    }
                } else {
                    logger.info("AutoSync", "Cloud has changed.");
                    if (localUpdateTimestamp > lastSyncTimestamp) {
                        logger.info("AutoSync", "Local has changed too. Triggering Unification UI.");
                        this.isSyncing = false; // Release lock for UI interaction
                        SyncUnificationUI.show(this.packData(), cloudData, async (choice) => {
                            this.isSyncing = true;
                            if (choice === 'merge') {
                                await this.smartMerge(cloudData, cloudSha);
                            } else if (choice === 'cloud') {
                                this.unpackAndApply(cloudData);
                                localStorage.setItem("sync_github_sha", cloudSha);
                                localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
                            } else if (choice === 'local') {
                                await this._doPush(cloudSha);
                            }
                            window.dispatchEvent(new CustomEvent("sync-end"));
                        });
                        return; // Exit and wait for UI callback
                    } else {
                        logger.info("AutoSync", "No local changes. Pulling from cloud.");
                        this.unpackAndApply(cloudData);
                        localStorage.setItem("sync_github_sha", cloudSha);
                        localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
                    }
                }
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
            const localSha = localStorage.getItem("sync_github_sha");
            await this._doPush(localSha);
            window.dispatchEvent(new CustomEvent("sync-end"));
        } catch (e) {
            logger.error("AutoPush", e);
            // If it's a conflict (409 from Github API), we should trigger autoSync to resolve it
            if (e.message.includes("409")) {
                 logger.warn("AutoPush", "Conflict detected during push. Triggering autoSync...");
                 this.isSyncing = false;
                 await this.autoSync();
                 return;
            }
            window.dispatchEvent(new CustomEvent("sync-error"));
        } finally {
            this.isSyncing = false;
        }
    },

    async _doPush(currentSha) {
        const localData = this.packData();
        const newSha = await GithubSync.uploadData(localData, currentSha);
        localStorage.setItem("sync_github_sha", newSha);
        localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
        logger.info("_doPush", "Success");
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

    async smartMerge(cloudData, cloudSha) {
        if (!cloudData || !cloudData.payload) return;
        
        const localData = this.packData();
        const mergedPayload = { ...localData.payload };
        
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

        // For other keys, just take the one with the newest overall timestamp
        Object.entries(cloudData.payload).forEach(([key, value]) => {
            if (key === "sutta_bookmarks" || key === "sutta_history") return;
            
            if (!mergedPayload[key] || cloudData.timestamp > localData.timestamp) {
                mergedPayload[key] = value;
            }
        });

        // Apply back locally
        this.unpackAndApply({ payload: mergedPayload });
        
        // Push merged back to cloud
        const mergedDataToPush = {
            version: 1,
            timestamp: Date.now(),
            payload: mergedPayload
        };
        const newSha = await GithubSync.uploadData(mergedDataToPush, cloudSha);
        localStorage.setItem("sync_github_sha", newSha);
        localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
        logger.info("SmartMerge", "Done and pushed to cloud.");
    },

    async forcePush() {
        logger.info("ForcePush", "Overwriting cloud with local data...");
        // Get cloud sha first to overwrite safely
        const cloudResult = await GithubSync.downloadData();
        const cloudSha = cloudResult ? cloudResult.sha : null;
        await this._doPush(cloudSha);
        logger.info("ForcePush", "Done");
    },

    async forcePull() {
        logger.info("ForcePull", "Overwriting local with cloud data...");
        const cloudResult = await GithubSync.downloadData();
        if (cloudResult) {
            this.unpackAndApply(cloudResult.data);
            localStorage.setItem("sync_github_sha", cloudResult.sha);
            localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
            logger.info("ForcePull", "Done");
        } else {
            logger.warn("ForcePull", "No cloud data to pull");
        }
    }
};
