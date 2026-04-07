// Path: web/assets/modules/data/sutta_db.js
import { getLogger } from 'utils/logger.js';
import { initSQLite } from 'services/sqlite_helper.js';

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
            // 1. Load Manifest
            const manifestResp = await fetch('/assets/db/db_manifest.json');
            this.manifest = await manifestResp.json();

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
        const dbVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "dev";
        const url = `/assets/db/${fileName}?v=${dbVersion}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${fileName}`);

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];
        
        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (onProgress && total) onProgress(loaded, total);
        }

        const buffer = new Uint8Array(loaded);
        let pos = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, pos);
            pos += chunk.length;
        }

        return new File([buffer], fileName, { type: 'application/x-sqlite3' });
    }

    static async _waitForInit() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.core) {
                    clearInterval(interval);
                    resolve(true);
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
}
