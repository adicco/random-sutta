// Path: web/assets/modules/data/sutta_db.js
import { getLogger } from 'utils/logger.js';
import { initSQLite } from 'services/sqlite_helper.js';
import { BlobCache } from 'services/blob_cache.js';

const logger = getLogger("SuttaDB");

export class SuttaDB {
    static core = null;
    static shards = new Map(); // Category -> DB Instance (Cached in RAM)
    static isInitializing = false;
    static loadingPromises = new Map(); // Category -> Promise (Tránh race condition)

    /**
     * Khởi động Core Database (Metadata, Structure, Config)
     */
    static async init(onProgress) {
        if (this.core) return true;
        if (this.isInitializing) return this._waitForInit();

        this.isInitializing = true;
        try {
            // [OFFLINE FIX] Try to load Manifest from Cache first if offline
            let manifestData = null;
            try {
                const manifestResp = await fetch('assets/db/db_manifest.json');
                manifestData = await manifestResp.json();
                // Cache the manifest
                await BlobCache.setBlob('db_manifest', new TextEncoder().encode(JSON.stringify(manifestData)).buffer);
            } catch (e) {
                logger.warn("Init", "Failed to fetch manifest, trying BlobCache...", e);
                const cachedManifestBuffer = await BlobCache.getBlob('db_manifest');
                if (cachedManifestBuffer) {
                    const text = new TextDecoder().decode(cachedManifestBuffer);
                    manifestData = JSON.parse(text);
                    logger.info("Init", "Loaded manifest from BlobCache.");
                }
            }

            this.manifest = manifestData || {};

            // 2. Load Core DB
            const coreFileName = "sutta_core.db";
            const coreFile = await this._fetchFile(coreFileName, onProgress);
            
            this.core = await initSQLite({
                path: coreFileName,
                file: coreFile
            });

            this.isInitializing = false;
            return true;
        } catch (e) {
            logger.error("Init", "Failed to initialize Core DB", e);
            this.isInitializing = false;
            return false;
        }
    }

    /**
     * Nạp một Content Shard (Memory Caching)
     */
    static async loadShard(category, onProgress) {
        // Trả về shard nếu đã có trong RAM
        if (this.shards.has(category)) return this.shards.get(category);
        
        // Tránh nhiều request nạp cùng 1 shard đồng thời
        if (this.loadingPromises.has(category)) {
             return await this.loadingPromises.get(category);
        }

        const loadPromise = (async () => {
            try {
                const fileName = `sutta_content_${category}.db`;
                logger.info("LoadShard", `Loading ${fileName} to RAM Cache...`);

                const file = await this._fetchFile(fileName, onProgress);
                const instance = await initSQLite({
                    path: fileName,
                    file: file
                });
                
                // Lưu trữ shard trong RAM để dùng lại (tổng 4 shard ~ 90MB)
                this.shards.set(category, instance);
                return instance;
            } catch (e) {
                logger.error("LoadShard", `Failed to load shard ${category}`, e);
                return null;
            } finally {
                this.loadingPromises.delete(category);
            }
        })();

        this.loadingPromises.set(category, loadPromise);
        return await loadPromise;
    }
static async _fetchFile(fileName, onProgress) {
    // [OPTIMIZED] Dùng hash từ manifest để cache buster chính xác hơn APP_VERSION
    let fileVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "dev";
    let targetHash = null;
    if (this.manifest && this.manifest.files && this.manifest.files[fileName]) {
        targetHash = this.manifest.files[fileName].hash;
        fileVersion = targetHash.substring(0, 8);
    }

        // [OFFLINE FIX] Read from IndexedDB BlobCache first to bypass SW fetch requirement on iOS
        const cacheKey = `db_${fileName}_${targetHash || fileVersion}`;
        try {
            const cachedBuffer = await BlobCache.getBlob(cacheKey);
            if (cachedBuffer) {
                logger.info("FetchFile", `Loaded ${fileName} from local BlobCache (Offline Safe)`);
                return new File([cachedBuffer], fileName, { type: 'application/x-sqlite3' });
            }
        } catch (e) {
            logger.warn("FetchFile", "Error reading BlobCache", e);
        }

    const url = `assets/db/${fileName}?v=${fileVersion}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${fileName}`);

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (onProgress && total > 0) {
            onProgress(loaded, total);
        }
    }

    const buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
    }

        // [OFFLINE FIX] Save to BlobCache for future offline loads
        try {
            // Need to store the underlying ArrayBuffer
            await BlobCache.setBlob(cacheKey, buffer.buffer);
            logger.info("FetchFile", `Saved ${fileName} to BlobCache`);
        } catch (e) {
            logger.warn("FetchFile", "Error writing to BlobCache", e);
        }

        return new File([buffer], fileName, { type: 'application/x-sqlite3' });
    }
    static async _waitForInit() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.core) {
                    clearInterval(interval);
                    resolve(true);
                } else if (!this.isInitializing) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 50);
        });
    }

    /**
     * Query vào Core DB
     */
    static async query(sql, params) {
        if (!this.core) await this.init();
        return await this.core.run(sql, params);
    }

    /**
     * Query vào một Content Shard cụ thể
     */
    static async queryShard(category, sql, params) {
        const shard = await this.loadShard(category);
        if (!shard) return [];
        return await shard.run(sql, params);
    }

    /**
     * [DEBUG] Chạy thử nghiệm hiệu năng truy vấn
     */
    static async runBenchmark() {
        logger.info("Benchmark", "Starting Query Performance Test...");
        
        // 1. Core DB Query (Metadata)
        const startCore = performance.now();
        await this.query("SELECT * FROM metadata WHERE book_id = 'dn' LIMIT 100");
        const endCore = performance.now();
        logger.info("Benchmark", `Core DB (100 rows): ${(endCore - startCore).toFixed(2)}ms`);

        // 2. Random Pool (Counting with index)
        const startCount = performance.now();
        await this.query("SELECT COUNT(*) FROM random_pools WHERE book_id IN ('mn', 'dn', 'sn', 'an')");
        const endCount = performance.now();
        logger.info("Benchmark", `Random Count (Index): ${(endCount - startCount).toFixed(2)}ms`);

        // 3. Shard DB Query (Content)
        const startShard = performance.now();
        await this.queryShard("major", "SELECT * FROM content_segments WHERE sutta_uid = 'dn1' ORDER BY segment_order");
        const endShard = performance.now();
        logger.info("Benchmark", `Shard Content (major): ${(endShard - startShard).toFixed(2)}ms`);
    }
}
