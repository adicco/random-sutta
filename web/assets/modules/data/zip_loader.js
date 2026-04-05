// Path: web/assets/modules/data/zip_loader.js
import { getLogger } from 'utils/logger.js';
import JSZip from 'jszip';

const logger = getLogger("ZipLoader");

export const ZipLoader = {
    /**
     * Tải file Zip, giải nén và lưu toàn bộ nội dung vào Cache Storage.
     * * @param {string} zipUrl - Đường dẫn tới file .zip (VD: assets/db/db_bundle.zip)
     * @param {string} targetCacheName - Tên Cache Storage để lưu (VD: sutta-cache-v1)
     * @param {string} pathPrefix - Tiền tố đường dẫn cho các file con (VD: assets/db/)
     * @param {Function} [onProgress] - Callback báo tiến độ (current, total)
     * @returns {Promise<void>}
     */
    async importBundleToCache(zipUrl, targetCacheName, pathPrefix = "", onProgress) {
        // 2. Tải file ZIP
        logger.info("Import", `Fetching bundle: ${zipUrl}`);
        const response = await fetch(zipUrl);
        if (!response.ok) {
            throw new Error(`Failed to download bundle: HTTP ${response.status}`);
        }
        const blob = await response.blob();

        // 3. Giải nén
        logger.info("Import", "Unzipping content...");
        const zip = await JSZip.loadAsync(blob);
        
        // Lọc bỏ thư mục, chỉ lấy file
        const files = Object.keys(zip.files).filter(filename => !zip.files[filename].dir);
        const total = files.length;
        let processed = 0;

        if (total === 0) {
            logger.warn("Import", "Zip bundle is empty.");
            return;
        }

        // 4. Mở Cache đích
        const cache = await caches.open(targetCacheName);

        // 5. Xử lý Batch (Tránh treo UI)
        const BATCH_SIZE = 20;
        
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (filename) => {
                // Đọc nội dung file từ Zip (Text JSON)
                const content = await zip.file(filename).async("string");
                
                // Tạo Response giả lập (Mock Response)
                // Đây là bước quan trọng để Service Worker "nghĩ" rằng nó đã cache file này từ mạng
                const mockResponse = new Response(content, {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                    statusText: 'OK'
                });

                // Xây dựng đường dẫn đích: prefix + filename trong zip
                // VD: "assets/db/" + "meta/mn.json"
                const cacheUrl = `${pathPrefix}${filename}`;
                
                // Đưa vào Cache
                await cache.put(cacheUrl, mockResponse);
            }));

            processed += batch.length;
            
            // Báo cáo tiến độ
            if (onProgress) {
                // Sử dụng setTimeout để đẩy callback ra khỏi luồng xử lý chính (non-blocking)
                setTimeout(() => onProgress(Math.min(processed, total), total), 0);
            }
        }

        logger.info("Import", `Success! Cached ${total} files from bundle.`);
    }
};