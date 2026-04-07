// Path: web/assets/modules/data/sutta_db.js
import { getLogger } from 'utils/logger.js';
import { initSQLite } from 'services/sqlite_helper.js';

const logger = getLogger("SuttaDB");

export class SuttaDB {
    static core = null;
    static activeCategory = null;
    static activeShard = null;
    static isInitializing = false;
    static loadingPromise = null; // Tránh race condition khi nạp shard

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
     * Nạp một Content Shard (Memory Swapping)
     */
    static async loadShard(category, onProgress) {
        if (this.activeCategory === category && this.activeShard) return this.activeShard;
        
        // Tránh nhiều request nạp shard chạy đồng thời (Race Condition)
        if (this.loadingPromise) {
             const result = await this.loadingPromise;
             // Nếu kết quả trả về đúng category mình cần thì lấy, không thì nạp lại
             if (this.activeCategory === category) return result;
        }

        this.loadingPromise = (async () => {
            try {
                // 1. Dọn dẹp Shard cũ (Giải phóng RAM)
                if (this.activeShard) {
                    logger.info("LoadShard", `Unloading previous shard: ${this.activeCategory}`);
                    await this.activeShard.close();
                    this.activeShard = null;
                    this.activeCategory = null;
                }

                // 2. Nạp Shard mới
                const fileName = `sutta_content_${category}.db`;
                logger.info("LoadShard", `Loading ${fileName} to RAM...`);

                const file = await this._fetchFile(fileName, onProgress);
                const instance = await initSQLite({
                    path: fileName,
                    file: file
                });
                
                this.activeShard = instance;
                this.activeCategory = category;
                return instance;
            } catch (e) {
                logger.error("LoadShard", `Failed to load shard ${category}`, e);
                return null;
            } finally {
                this.loadingPromise = null;
            }
        })();

        return await this.loadingPromise;
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
