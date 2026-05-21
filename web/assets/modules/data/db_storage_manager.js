// Path: web/assets/modules/data/db_storage_manager.js
import { getLogger } from 'utils/logger.js';
import { importToPersistentStorage } from 'services/sqlite_helper.js';
import { BlobCache } from 'services/blob_cache.js';

const logger = getLogger("StorageManager");

/**
 * Quản lý việc lưu trữ, tải xuống và cập nhật các file Database (VFS)
 */
export const DbStorageManager = {
    /**
     * Đảm bảo Database đã được cập nhật dựa trên manifest.
     */
    async ensureUpdated(dbName, manifest, onProgress) {
        const targetHash = manifest?.files?.[dbName]?.hash || "dev";
        const currentHash = await this.getStoredHash(dbName);
        
        // 1. Kiểm tra xem có cần update không (dựa trên hash)
        let needsUpdate = currentHash !== targetHash;
        
        if (!needsUpdate) {
            logger.debug("Ensure", `Hash matches for ${dbName}, skipping update.`);
            if (onProgress) onProgress(100, 100);
            return false;
        }

        // 2. Nếu cần update, download và import
        logger.info("Ensure", `Updating ${dbName}: ${currentHash} -> ${targetHash}`);
        try {
            const fileStream = await this.fetchFile(dbName, targetHash, onProgress);
            await importToPersistentStorage(dbName, fileStream);
            await this.setStoredHash(dbName, targetHash);
            return true;
        } catch (e) {
            logger.error("Ensure", `Failed to update ${dbName}`, e);
            throw e;
        }
    },

    async getStoredHash(dbName) {
        return await BlobCache.getBlob(`hash_${dbName}`) || null;
    },

    async setStoredHash(dbName, hash) {
        await BlobCache.setBlob(`hash_${dbName}`, hash);
    },

    /**
     * Tải file từ server (Hỗ trợ Streaming & Gzip)
     */
    async fetchFile(fileName, hash, onProgress) {
        const query = `?v=${hash || Date.now()}`;
        
        const tryFetchFile = async (basePath) => {
            if ('DecompressionStream' in window) {
                try {
                    const response = await fetch(`${basePath}${fileName}.gz${query}`);
                    if (response.ok && !response.headers.get("content-type")?.includes("text/html")) {
                        return { response, isGz: true };
                    }
                } catch (e) {}
            }

            try {
                const response = await fetch(`${basePath}${fileName}${query}`);
                if (response.ok && !response.headers.get("content-type")?.includes("text/html")) {
                    return { response, isGz: false };
                }
            } catch (e) {}
            return null;
        };

        let result = await tryFetchFile('assets/db/');
        if (!result) result = await tryFetchFile('/assets/db/');
        
        if (!result) throw new Error(`Could not fetch database file: ${fileName}`);

        const { response, isGz } = result;
        const total = parseInt(response.headers.get('content-length') || "0", 10);
        let loaded = 0;

        const progressStream = new TransformStream({
            transform(chunk, controller) {
                loaded += chunk.length;
                if (onProgress && total > 0) onProgress(loaded, total);
                controller.enqueue(chunk);
            }
        });

        const reader = response.body.getReader();
        const { done, value } = await reader.read();
        
        if (done) throw new Error("Empty response body");

        // Kiểm tra GZIP magic bytes [0x1F, 0x8B]
        let needsDecompression = (value[0] === 0x1f && value[1] === 0x8b);

        const combinedStream = new ReadableStream({
            start(controller) { controller.enqueue(value); },
            async pull(controller) {
                const { done, value } = await reader.read();
                if (done) controller.close(); else controller.enqueue(value);
            },
            cancel() { reader.cancel(); }
        });

        let finalStream = combinedStream.pipeThrough(progressStream);
        if (needsDecompression && isGz) {
            finalStream = finalStream.pipeThrough(new DecompressionStream('gzip'));
        }

        return finalStream;
    }
};
