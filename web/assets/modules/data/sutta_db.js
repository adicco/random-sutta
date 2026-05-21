// Path: web/assets/modules/data/sutta_db.js
import { getLogger } from 'utils/logger.js';
import { initSQLitePersistent, getSharedSqlite } from 'services/sqlite_helper.js';
import { DbManifestManager } from './db_manifest_manager.js';
import { DbStorageManager } from './db_storage_manager.js';

const logger = getLogger("SuttaDB");

/**
 * Interface chính để truy cập Sutta Databases.
 * Đóng vai trò Facade kết nối ManifestManager, StorageManager và Connection Pool.
 */
export class SuttaDB {
    static core = null;
    static shards = new Map(); // Category -> DB Instance (Persistent)
    static SHARD_LIMIT = 5; 
    static isInitializing = false;
    static loadingPromises = new Map();

    /**
     * Proxy tới manifest thực tế để đảm bảo backward compatibility
     */
    static get manifest() {
        return DbManifestManager.manifest;
    }

    /**
     * Khởi động Core Database (Metadata, Structure, Config)
     */
    static async init(onProgress) {
        if (this.core) return true;
        if (this.isInitializing) return this._waitForInit();

        this.isInitializing = true;
        try {
            // [OPTIMIZED] Pre-warm WASM and VFS in parallel
            getSharedSqlite().catch(() => {});

            // 1. Load manifest (Cache-first)
            await DbManifestManager.load();

            // 2. Load Core DB
            const dbName = "sutta_core.db";
            this.core = await this._getOrUpdateDB(dbName, onProgress);

            this.isInitializing = false;
            
            // [Background] Check for update
            DbManifestManager.refreshInBackground();

            return true;
        } catch (e) {
            logger.error("Init", "Failed to initialize Core DB", e);
            this.isInitializing = false;
            return false;
        }
    }

    /**
     * Nạp một Content Shard
     */
    static async loadShard(category, onProgress) {
        if (this.shards.has(category)) {
            // [LRU] Move to end
            const instance = this.shards.get(category);
            this.shards.delete(category);
            this.shards.set(category, instance);
            return instance;
        }
        
        if (this.loadingPromises.has(category)) {
             return await this.loadingPromises.get(category);
        }

        const loadPromise = (async () => {
            try {
                if (this.shards.size >= this.SHARD_LIMIT) {
                    const oldestCategory = this.shards.keys().next().value;
                    logger.info("Pool", `Shard limit reached. Closing: ${oldestCategory}`);
                    await this.closeShard(oldestCategory);
                }

                const dbName = `sutta_content_${category}.db`;
                const instance = await this._getOrUpdateDB(dbName, onProgress);
                this.shards.set(category, instance);
                return instance;
            } catch (e) {
                logger.error("LoadShard", `Failed: ${category}`, e);
                return null;
            } finally {
                this.loadingPromises.delete(category);
            }
        })();

        this.loadingPromises.set(category, loadPromise);
        return await loadPromise;
    }

    /**
     * Lấy DB từ Storage, cập nhật nếu cần, rồi mở kết nối.
     * Bao gồm logic retry nếu file hỏng.
     */
    static async _getOrUpdateDB(dbName, onProgress) {
        try {
            await DbStorageManager.ensureUpdated(dbName, this.manifest, onProgress);
            return await initSQLitePersistent({ dbName });
        } catch (e) {
            logger.warn("Storage", `Failed to open ${dbName}, attempting re-download...`);
            await DbStorageManager.setStoredHash(dbName, null);
            await DbStorageManager.ensureUpdated(dbName, this.manifest, onProgress);
            return await initSQLitePersistent({ dbName });
        }
    }

    /**
     * Tải Shard về máy (Offline) nhưng KHÔNG mở kết nối.
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
        await DbStorageManager.ensureUpdated(dbName, this.manifest, onProgress);
        logger.info("Storage", `Prefetch completed for ${dbName}`);
    }

    static async closeShard(category) {
        const instance = this.shards.get(category);
        if (instance) {
            await instance.close();
            this.shards.delete(category);
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

    static async query(sql, params) {
        if (!this.core) await this.init();
        return await this.core.run(sql, params);
    }

    static async queryShard(category, sql, params) {
        const shard = await this.loadShard(category);
        return shard ? await shard.run(sql, params) : [];
    }

    static async runBenchmark() {
        logger.info("Benchmark", "Starting...");
        const start = performance.now();
        await this.query("SELECT * FROM metadata LIMIT 10");
        logger.info("Benchmark", `Completed in ${(performance.now() - start).toFixed(2)}ms`);
    }
}
