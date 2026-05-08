// Path: web/assets/modules/data/sutta_db.js
import { getLogger } from 'utils/logger.js';
import { initSQLitePersistent } from 'services/sqlite_helper.js';
import { BlobCache } from 'services/blob_cache.js';

const logger = getLogger("SuttaDB");

export class SuttaDB {
    static core = null;
    static shards = new Map(); // Category -> DB Instance (Persistent)
    static isInitializing = false;
    static loadingPromises = new Map();

    /**
     * Khởi động Core Database (Metadata, Structure, Config)
     */
    static async init(onProgress) {
        if (this.core) return true;
        if (this.isInitializing) return this._waitForInit();

        this.isInitializing = true;
        try {
            await this._loadManifest();

            const dbName = "sutta_core.db";
            this.core = await this._getOrUpdateDB(dbName, onProgress);

            this.isInitializing = false;
            return true;
        } catch (e) {
            logger.error("Init", "Failed to initialize Core DB", e);
            this.isInitializing = false;
            return false;
        }
    }

    /**
     * Nạp một Content Shard (Sử dụng Persistent Storage để tiết kiệm RAM)
     */
    static async loadShard(category, onProgress) {
        if (this.shards.has(category)) return this.shards.get(category);
        
        if (this.loadingPromises.has(category)) {
             return await this.loadingPromises.get(category);
        }

        const loadPromise = (async () => {
            try {
                const dbName = `sutta_content_${category}.db`;
                const instance = await this._getOrUpdateDB(dbName, onProgress);
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

    /**
     * Logic trung tâm: Đảm bảo DB được tải về và cập nhật trong Storage.
     */
    static async _ensureDbUpdated(dbName, onProgress) {
        const targetHash = this.manifest?.files?.[dbName]?.hash || "dev";
        const currentHash = await this._getStoredHash(dbName);
        
        // 1. Kiểm tra xem có cần update không (dựa trên hash hoặc DB rỗng)
        let needsUpdate = currentHash !== targetHash;
        
        if (!needsUpdate) {
            // Check nếu file thực sự tồn tại trong VFS bằng cách mở thử
            const testInstance = await initSQLitePersistent({ dbName });
            const empty = await testInstance.isEmpty();
            await testInstance.close();
            if (empty) needsUpdate = true;
        }

        // 2. Nếu cần update, download và import
        if (needsUpdate) {
            logger.info("Storage", `Updating ${dbName}: ${currentHash} -> ${targetHash}`);
            const file = await this._fetchFile(dbName, onProgress);
            const { importToPersistentStorage } = await import('services/sqlite_helper.js');
            await importToPersistentStorage(dbName, file);
            await this._setStoredHash(dbName, targetHash);
            return true;
        } else {
            logger.info("Storage", `Using persistent DB: ${dbName} (${targetHash})`);
            if (onProgress) onProgress(100, 100);
            return false;
        }
    }

    /**
     * Lấy DB từ Storage, cập nhật nếu cần, rồi mở kết nối.
     */
    static async _getOrUpdateDB(dbName, onProgress) {
        await this._ensureDbUpdated(dbName, onProgress);
        // 3. Mở kết nối chính thức
        return await initSQLitePersistent({ dbName });
    }

    /**
     * Tải Shard về máy (Offline) nhưng KHÔNG mở kết nối giữ chỗ.
     * Tránh xung đột đóng shard đang dùng.
     */
    static async prefetchShard(category, onProgress) {
        if (this.shards.has(category)) {
            if (onProgress) onProgress(100, 100);
            return;
        }
        if (this.loadingPromises.has(category)) {
            await this.loadingPromises.get(category);
            if (onProgress) onProgress(100, 100);
            return;
        }
        const dbName = `sutta_content_${category}.db`;
        await this._ensureDbUpdated(dbName, onProgress);
    }

    /**
     * Giải phóng bộ nhớ bằng cách đóng Shard không dùng
     */
    static async closeShard(category) {
        const instance = this.shards.get(category);
        if (instance) {
            await instance.close();
            this.shards.delete(category);
            logger.info("Storage", `Closed shard ${category} to free RAM`);
        }
    }

    static async closeAll() {
        for (const category of this.shards.keys()) {
            await this.closeShard(category);
        }
        if (this.core) {
            await this.core.close();
            this.core = null;
        }
    }

    static async _loadManifest() {
        try {
            const resp = await fetch('assets/db/db_manifest.json');
            this.manifest = await resp.json();
            await BlobCache.setBlob('db_manifest', new TextEncoder().encode(JSON.stringify(this.manifest)).buffer);
        } catch (e) {
            const cached = await BlobCache.getBlob('db_manifest');
            if (cached) {
                this.manifest = JSON.parse(new TextDecoder().decode(cached));
            }
        }
    }

    // --- Versioning Helpers ---
    static async _getStoredHash(dbName) {
        return await BlobCache.getBlob(`hash_${dbName}`) || null;
    }

    static async _setStoredHash(dbName, hash) {
        await BlobCache.setBlob(`hash_${dbName}`, hash);
    }

    static async _fetchFile(fileName, onProgress) {
        const url = `assets/db/${fileName}?v=${this.manifest?.files?.[fileName]?.hash || Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${fileName}`);

        const total = parseInt(response.headers.get('content-length') || "0", 10);
        let loaded = 0;
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (onProgress && total > 0) onProgress(loaded, total);
        }

        // Tối ưu RAM: Tạo File trực tiếp từ mảng các chunk thay vì ghép vào Uint8Array mới
        return new File(chunks, fileName, { type: 'application/x-sqlite3' });
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
