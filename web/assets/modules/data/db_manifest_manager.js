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
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
                const resp = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (resp.ok) {
                    const contentType = resp.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        return await resp.json();
                    }
                    const text = await resp.text();
                    if (text.trim().startsWith("<!DOCTYPE")) return null;
                    return JSON.parse(text);
                }
            } catch (e) {}
            return null;
        };

        try {
            let data = await tryFetch('assets/db/db_manifest.json');
            if (!data) data = await tryFetch('/assets/db/db_manifest.json');
            
            if (data) {
                const isFirstLoad = !this.manifest;
                this.manifest = data;
                await BlobCache.setBlob('db_manifest', new TextEncoder().encode(JSON.stringify(this.manifest)).buffer);
                
                logger.info("Refresh", isFirstLoad ? "Loaded from network" : "Updated from network (Background)");
                return this.manifest;
            } else {
                logger.warn("Refresh", "Network fetch failed or returned invalid data");
            }
        } catch (e) {
            logger.warn("Refresh", "Manifest update process failed", e);
        }
        return this.manifest;
    },

    getHash(dbName) {
        return this.manifest?.files?.[dbName]?.hash || "dev";
    }
};
