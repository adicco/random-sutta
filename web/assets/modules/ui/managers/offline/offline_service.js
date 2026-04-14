// Path: web/assets/modules/ui/managers/offline/offline_service.js
import { SuttaRepository } from 'data/sutta_repository.js';
import { getLogger } from 'utils/logger.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("OfflineService");
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "dev-placeholder";

const STORAGE_KEYS = {
    VERSION: 'sutta_offline_version',
    DB_HASH: 'sutta_db_hash' // [NEW] Key lưu hash hiện tại
};

// Tên DB định nghĩa trong SuttaRepository (cần khớp)
const DB_NAME = 'sutta_db';

export const OfflineService = {
    isOfflineReady() {
        return localStorage.getItem(STORAGE_KEYS.VERSION) === APP_VERSION;
    },

    async requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const isPersisted = await navigator.storage.persisted();
                if (isPersisted) return true;
                return await navigator.storage.persist();
            } catch (e) {
                logger.error("Storage", "Error requesting persistence", e);
                return false;
            }
        }
        return false;
    },

    async checkQuota() {
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const { usage, quota } = await navigator.storage.estimate();
                return {
                    usedMB: (usage / (1024 * 1024)).toFixed(2),
                    quotaMB: (quota / (1024 * 1024)).toFixed(2),
                    percent: ((usage / quota) * 100).toFixed(1)
                };
            } catch (e) {
                logger.warn("Quota", "Estimate failed", e);
            }
        }
        return null;
    },

    // [NEW] Download Manifest từ Server
    async checkUpdate() {
        try {
            const response = await fetch('assets/db/db_manifest.json?t=' + Date.now()); // Anti-cache query
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            logger.warn("Manifest", "Could not fetch manifest", e);
            return null;
        }
    },

    // [NEW] Xóa Database thủ công (Helper)
    _wipeDatabase() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => {
                logger.info("DB", "Database wiped successfully.");
                resolve();
            };
            req.onerror = (e) => {
                logger.error("DB", "Failed to wipe database", e);
                reject(e);
            };
            req.onblocked = () => {
                logger.warn("DB", "Wipe blocked. Close other tabs.");
            };
        });
    },

    async performFullDownload(onProgress) {
        await this.requestPersistentStorage();
        
        // 1. Download Manifest First (để lấy hash chuẩn bị lưu)
        const manifest = await this.checkUpdate();
        
        // 2. Download & Unzip DB
        await SuttaRepository.downloadAll(onProgress);
        
        // 3. Mark as Ready & Save Hash
        localStorage.setItem(STORAGE_KEYS.VERSION, APP_VERSION);
        if (manifest && manifest.hash) {
            localStorage.setItem(STORAGE_KEYS.DB_HASH, manifest.hash);
            logger.info("Download", `Saved DB Hash: ${manifest.hash}`);
        }
    },

    /**
     * [NEW] Logic cập nhật thông minh
     * @returns {Promise<boolean>} true nếu cần reload trang
     */
    async smartUpdate() {
        logger.info("Update", "Checking for updates...");
        
        // 1. Lấy Manifest mới nhất
        const remoteManifest = await this.checkUpdate();
        const localHash = localStorage.getItem(STORAGE_KEYS.DB_HASH);

        let dataChanged = true;

        if (remoteManifest && localHash) {
            if (remoteManifest.hash === localHash) {
                logger.info("Update", "✅ Data Hash matches. Preserving DB.");
                dataChanged = false;
            } else {
                logger.info("Update", "⚠️ Hash mismatch. Data update required.");
            }
        } else {
            logger.warn("Update", "Missing manifest or local hash. Forcing full update.");
        }

        // 2. Clear SW Caches & Service Worker (Code Update)
        // Điều này bắt buộc để trình duyệt tải file JS/CSS/HTML mới nhất
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) await reg.unregister();
        }
        
        // [FIX] Don't wipe caches blindly here. It deletes the Dictionary (dpd_mini.db.zip)
        // which causes a full redownload even if only scripts changed.
        // The new Service Worker (after unregister + reload) will handle cache cleanup/versioning.
        /* 
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) await caches.delete(key);
        } 
        */

        // 3. Handle Data
        if (dataChanged) {
            // Wipe DB -> App will treat this as fresh install on reload and auto-download
            try {
                await this._wipeDatabase();
            } catch (e) { console.error(e); }
            
            localStorage.removeItem(STORAGE_KEYS.VERSION);
            localStorage.removeItem(STORAGE_KEYS.DB_HASH);
        } else {
            // Keep DB -> Chỉ cập nhật version string trong localStorage để khớp với bản build mới
            // (Phòng khi version code thay đổi dù data không đổi)
            localStorage.setItem(STORAGE_KEYS.VERSION, APP_VERSION);
            logger.info("Update", "Skipping DB wipe.");
        }

        return true; // Signal to reload
    },

    async factoryReset() {
        const backup = {};
        if (AppConfig.PERSISTENT_SETTINGS) {
            AppConfig.PERSISTENT_SETTINGS.forEach(key => {
                const val = localStorage.getItem(key);
                if (val !== null) backup[key] = val;
            });
        }

        localStorage.clear();

        Object.entries(backup).forEach(([key, val]) => {
            localStorage.setItem(key, val);
        });

        // Wipe DB
        try {
            await this._wipeDatabase();
        } catch(e) {}

        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) await reg.unregister();
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) await caches.delete(key);
        }
    }
};