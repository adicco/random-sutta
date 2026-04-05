// Path: web/assets/modules/data/sutta_repository.js
import { CoreNetwork } from './core_network.js';
import { ZipLoader } from './zip_loader.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("SuttaRepository");
const DB_PATH = "assets/db";

// Buffer vùng nhớ cho JSONP (Offline Mode)
const dataBuffer = {};

// Thiết lập cổng giao tiếp toàn cục cho các file .js data gọi vào
window.__DB_LOADER__ = {
    receive: (key, data) => {
        dataBuffer[key] = data;
    },
    // Backward compatibility helpers
    getMeta: (id) => null,
    getContent: (id) => null
};

export const SuttaRepository = {
    
    async init() {
        if (this._isOfflineBuild()) {
            logger.info("Init", "Detected OFFLINE BUILD mode (JSONP Strategy).");
        } else if (this._isOfflineReady()) {
            logger.info("Init", "Detected HYBRID mode (Cache-First Strategy).");
        } else {
            logger.info("Init", "Detected ONLINE mode (Fetch Strategy).");
        }
    },

    // --- UTILS ---

    /**
     * Kiểm tra xem đây có phải là bản Build Offline hay không.
     * Dựa vào biến toàn cục do `offline_converter.py` inject vào index.html.
     */
    _isOfflineBuild() {
        return !!window.__DB_INDEX__;
    },

    /**
     * [NEW] Kiểm tra xem người dùng đã tải gói Offline Bundle chưa.
     */
    _isOfflineReady() {
        return !!localStorage.getItem('sutta_offline_version');
    },

    _getBucketId(uid) {
        let hash = 5381;
        for (let i = 0; i < uid.length; i++) {
            hash = ((hash << 5) + hash) + uid.charCodeAt(i);
            hash = hash & 0xFFFFFFFF; 
        }
        const unsignedHash = hash >>> 0;
        return String(unsignedHash % 20);
    },

    /**
     * [CORE LOGIC] Hàm tải dữ liệu thông minh.
     * Tự động chọn cách tải dựa trên môi trường build và cache.
     */
    async _loadData(category, filenameWithoutExt) {
        // TRƯỜNG HỢP 1: Bản Build Offline (Chạy file:// hoặc localhost:8002)
        // Dữ liệu nằm trong file .js, load bằng thẻ script
        if (this._isOfflineBuild()) {
            // Kiểm tra bộ đệm
            if (dataBuffer[filenameWithoutExt]) {
                return dataBuffer[filenameWithoutExt];
            }

            const scriptUrl = `${DB_PATH}/${category}/${filenameWithoutExt}.js`;
            try {
                await CoreNetwork.loadScript(scriptUrl);
                const data = dataBuffer[filenameWithoutExt];
                if (data) return data;
                throw new Error(`Data buffer empty after loading ${scriptUrl}`);
            } catch (e) {
                logger.error("LoadData", `Failed to load JS resource: ${filenameWithoutExt}`, e);
                return null;
            }
        } 
        
        // TRƯỜNG HỢP 2: Bản Online (Chạy localhost:8001 hoặc Web)
        else {
            const jsonUrl = `${DB_PATH}/${category}/${filenameWithoutExt}.json`;

            // [NEW LOGIC] Ưu tiên Cache API nếu đã có Offline Bundle
            if (this._isOfflineReady() && 'caches' in window) {
                try {
                    // Tìm cache chứa dữ liệu (thường bắt đầu bằng sutta-cache-)
                    const keys = await caches.keys();
                    const cacheName = keys.find(k => k.startsWith('sutta-cache-'));
                    
                    if (cacheName) {
                        const cache = await caches.open(cacheName);
                        const cachedResponse = await cache.match(jsonUrl);
                        
                        if (cachedResponse) {
                            // logger.debug("LoadData", `Cache Hit: ${filenameWithoutExt}`);
                            return await cachedResponse.json();
                        }
                    }
                } catch (e) {
                    logger.warn("LoadData", `Cache lookup failed for ${jsonUrl}, falling back to network.`, e);
                }
            }

            // Fallback: Fetch Network (sẽ lỗi nếu không có mạng và không có cache)
            return await CoreNetwork.fetchJson(jsonUrl);
        }
    },

    // --- PUBLIC API ---

    async resolveLocation(uid) {
        if (!uid) return null;
        const cleanUid = uid.toLowerCase().trim();

        // Ưu tiên 1: Tra cứu Index Tĩnh (Offline Build)
        if (window.__DB_INDEX__) {
            const loc = window.__DB_INDEX__[cleanUid];
            return loc || null;
        }

        // Ưu tiên 2: Tra cứu Index Động (Online Build)
        // Tải bucket index tương ứng
        const bucketId = this._getBucketId(cleanUid);
        const bucketData = await this._loadData("index", bucketId); // Sử dụng _loadData để linh hoạt
        
        if (bucketData && bucketData[cleanUid]) {
            return bucketData[cleanUid];
        }
        return null;
    },

    async fetchMeta(bookId) {
        return await this._loadData("meta", bookId);
    },

    async fetchContentChunk(bookId, chunkIdx) {
        const filename = `${bookId}_chunk_${chunkIdx}`;
        return await this._loadData("content", filename);
    },

    async fetchMetaList(bookIds) {
        const uniqueIds = [...new Set(bookIds)];
        const results = {};
        await Promise.all(uniqueIds.map(async (bid) => {
            const meta = await this.fetchMeta(bid);
            if (meta && meta.meta) {
                Object.assign(results, meta.meta);
            }
        }));
        return results;
    },

    async downloadAll(onProgress) {
        // [OPTIMIZATION] Nếu là bản Offline Build thì không cần download gì cả
        if (this._isOfflineBuild()) {
            logger.info("Sync", "Offline Build detected. Data is already local.");
            if (onProgress) onProgress(100, 100);
            return;
        }

        logger.info("Sync", "Starting Bundle Download...");
        
        const CACHE_NAME = (await caches.keys()).find(k => k.startsWith('sutta-cache-')) || 'sutta-cache-temp';
        
        // Gọi Core Script để xử lý Zip
        await ZipLoader.importBundleToCache(
            `${DB_PATH}/db_bundle.zip`, 
            CACHE_NAME, 
            `${DB_PATH}/`, 
            onProgress
        );
    }
};