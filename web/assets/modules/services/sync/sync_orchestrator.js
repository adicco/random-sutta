// Path: web/assets/modules/services/sync/sync_orchestrator.js
import { getLogger } from "utils/logger.js";
import { GithubAuthManager } from "services/sync/github_auth_manager.js";
import { GithubSync } from "services/sync/github_sync.js";
import { SyncUnificationUI } from "ui/managers/sync_unification_ui.js";

const logger = getLogger("SyncOrchestrator");

export const SyncOrchestrator = {
    SYNC_KEYS: ["sutta_bookmarks", "sutta_history", "last_read_sutta", "tts_auto_next", "tts_playback_mode", "tts_active_engine", "tts_rate", "tts_pitch", "tts_voice_uri"],
    DEBOUNCE_MS: 60000, // 1 minute debounce for cleaner history
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

        // [STRATEGY] Sync Unification on App Focus or Periodically
        // This ensures that if you change data on another device, this device notices it
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && GithubAuthManager.isAuthenticated()) {
                logger.info("Focus", "App became visible, checking for updates...");
                this.autoSync();
            }
        });

        // Heartbeat check every 5 minutes while open
        setInterval(() => {
            if (GithubAuthManager.isAuthenticated() && !this.isSyncing) {
                this.autoSync();
            }
        }, 5 * 60 * 1000);

        // Initial Sync if already authenticated
        if (GithubAuthManager.isAuthenticated()) {
            this.autoSync();
        }
    },

    autoSync() {
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
                        const localData = this.packData();
                        SyncUnificationUI.show(localData, cloudData, async (choice) => {
                            this.isSyncing = true;
                            if (choice === 'merge') {
                                await this.smartMerge(cloudData, cloudSha);
                            } else if (choice === 'cloud') {
                                this.unpackAndApply(cloudData);
                                localStorage.setItem("sync_github_sha", cloudSha);
                                localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
                            } else if (choice === 'local') {
                                await this._doPush(cloudSha);
                            } else if (choice === 'latest') {
                                // Latest logic
                                if (cloudData.timestamp > localData.timestamp) {
                                    this.unpackAndApply(cloudData);
                                    localStorage.setItem("sync_github_sha", cloudSha);
                                } else {
                                    await this._doPush(cloudSha);
                                }
                                localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
                            } else if (choice === 'cancel') {
                                logger.info("AutoSync", "User ignored unification choice.");
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
        const lastUpdate = parseInt(localStorage.getItem("sync_local_update_timestamp") || Date.now().toString(), 10);
        const data = {
            version: 1,
            timestamp: lastUpdate,
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

        if (cloudData.timestamp) {
            localStorage.setItem("sync_local_update_timestamp", cloudData.timestamp.toString());
        }
        
        // Notify app to refresh UI
        window.dispatchEvent(new CustomEvent("sync-data-applied"));
    },

    async smartMerge(cloudData, cloudSha) {
        if (!cloudData || !cloudData.payload) return;
        
        const localData = this.packData();
        const mergedPayload = { ...localData.payload };
        
        // Special logic for bookmarks (Object merge by UID)
        if (cloudData.payload.sutta_bookmarks) {
            const localBookmarks = localData.payload.sutta_bookmarks || {};
            let cloudBookmarks = cloudData.payload.sutta_bookmarks;
            
            // [COMPAT] Handle cloud sending legacy array
            if (Array.isArray(cloudBookmarks)) {
                const converted = {};
                cloudBookmarks.forEach(b => {
                    const uid = b.uid || b.id;
                    if (uid) converted[uid] = b;
                });
                cloudBookmarks = converted;
            }

            const mergedBookmarks = { ...localBookmarks };
            Object.keys(cloudBookmarks).forEach(uid => {
                if (!mergedBookmarks[uid] || cloudBookmarks[uid].timestamp > mergedBookmarks[uid].timestamp) {
                    mergedBookmarks[uid] = cloudBookmarks[uid];
                }
            });
            mergedPayload.sutta_bookmarks = mergedBookmarks;
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

        // Special logic for last_read_sutta
        if (cloudData.payload.last_read_sutta) {
            const localLastRead = localData.payload.last_read_sutta || {};
            const cloudLastRead = cloudData.payload.last_read_sutta;
            
            // Normalize cloud data (handle legacy 'id')
            if (cloudLastRead.id && !cloudLastRead.uid) {
                cloudLastRead.uid = cloudLastRead.id;
            }

            const isSameContent = localLastRead.uid === cloudLastRead.uid && 
                                Math.abs((localLastRead.scrollY || 0) - (cloudLastRead.scrollY || 0)) < 2;

            if (isSameContent) {
                // If content is same, just adopt the cloud timestamp to align, no need to push back
                mergedPayload.last_read_sutta = {
                    ...localLastRead,
                    timestamp: cloudLastRead.timestamp
                };
            } else if (!localLastRead.timestamp || cloudLastRead.timestamp > localLastRead.timestamp) {
                // Cloud is newer and different
                mergedPayload.last_read_sutta = cloudLastRead;
            }
            // else: local is newer and different, already in mergedPayload from the spread at start
        }

        // For other keys, just take the one with the newest overall timestamp
        Object.entries(cloudData.payload).forEach(([key, value]) => {
            if (key === "sutta_bookmarks" || key === "sutta_history" || key === "last_read_sutta") return;
            
            if (!mergedPayload[key] || cloudData.timestamp > localData.timestamp) {
                mergedPayload[key] = value;
            }
        });

        // Apply back locally
        const mergeTimestamp = Date.now();
        this.unpackAndApply({ 
            payload: mergedPayload,
            timestamp: mergeTimestamp
        });
        
        // Push merged back to cloud
        const mergedDataToPush = {
            version: 1,
            timestamp: mergeTimestamp,
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
