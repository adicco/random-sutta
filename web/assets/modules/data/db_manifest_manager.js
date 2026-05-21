// Path: web/assets/modules/data/db_manifest_manager.js
import { getLogger } from 'utils/logger.js';
import { BlobCache } from 'services/blob_cache.js';

const logger = getLogger("ManifestManager");

/**
 * Quản lý Manifest của Database (Phiên bản, Hash, Cấu trúc file)
 */
export const DbManifestManager = {
    manifest: null,

    /**
     * Nạp manifest (Ưu tiên Cache để khởi động nhanh)
     */
    async load() {
        try {
            const cached = await BlobCache.getBlob('db_manifest');
            if (cached) {
                this.manifest = JSON.parse(new TextDecoder().decode(cached));
                logger.info("Load", "Loaded from cache");
                return this.manifest;
            }
        } catch (e) {
            logger.warn("Load", "Failed to load from cache", e);
        }

        // Nếu không có cache, buộc phải fetch từ mạng
        return await this.refreshInBackground();
    },

    /**
     * Cập nhật manifest từ mạng và lưu vào cache.
     */
    async refreshInBackground() {
        const tryFetch = async (url) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); 
            try {
                const resp = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (resp.ok) {
                    const contentType = resp.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        return await resp.json();
                    }
                    return null;
                }
            } catch (e) {}
            return null;
        };

        try {
            let data = await tryFetch('assets/db/db_manifest.json');
            if (!data) data = await tryFetch('/assets/db/db_manifest.json');
            
            if (data) {
                const oldManifest = this.manifest;
                this.manifest = data;
                await BlobCache.setBlob('db_manifest', new TextEncoder().encode(JSON.stringify(this.manifest)).buffer);
                
                if (oldManifest) {
                    // [UPDATE DETECTION] Kiểm tra xem có file nào thay đổi hash không
                    const hasUpdate = this._checkForChanges(oldManifest, data);
                    if (hasUpdate) {
                        logger.info("Refresh", "New database version detected!");
                        this._notifyUpdate();
                    }
                } else {
                    logger.info("Refresh", "Manifest initialized from network.");
                }
                return this.manifest;
            }
        } catch (e) {
            logger.warn("Refresh", "Manifest update failed", e);
        }
        return this.manifest;
    },

    _checkForChanges(oldM, newM) {
        if (!oldM || !newM) return false;
        // Kiểm tra hash của các file quan trọng (core và dictionary)
        const criticalFiles = ['sutta_core.db', 'dictionaries/dpd_mini.db'];
        for (const file of criticalFiles) {
            if (oldM.files[file]?.hash !== newM.files[file]?.hash) return true;
        }
        // Kiểm tra xem có bất kỳ shard nào thay đổi không (optional, tùy UX)
        return false; 
    },

    _notifyUpdate() {
        // Gửi Custom Event để UI có thể bắt được và hiển thị thông báo "Update Available"
        const event = new CustomEvent('sutta-db-update', { 
            detail: { manifest: this.manifest } 
        });
        window.dispatchEvent(event);
    },

    getHash(dbName) {
        return this.manifest?.files?.[dbName]?.hash || "dev";
    }
};
