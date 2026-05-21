// Path: web/assets/modules/services/sqlite_connection.js
import { getLogger } from 'utils/logger.js';
import { initSQLitePersistent, importToPersistentStorage } from './sqlite_helper.js';
import { BlobCache } from './blob_cache.js';

const logger = getLogger("SqliteConnection");

export class SqliteConnection {
    constructor(dbName, zipUrl) {
        this.dbName = dbName;
        this.zipUrl = zipUrl; // E.g. assets/db/dictionaries/dpd_mini.db.gz
        this.db = null;
        this.isInitializing = false;
    }

    async init() {
        if (this.db) return true;
        if (this.isInitializing) return this._waitForInit();

        this.isInitializing = true;
        try {
            const hasUpdate = await this._checkAndApplyUpdate();
            const targetHash = localStorage.getItem(`${this.dbName}_hash`) || "dev";

            logger.info("Init", `Initializing persistent ${this.dbName}...`);
            
            // 1. Kiểm tra xem có cần nạp/cập nhật không
            let needsUpdate = hasUpdate;
            if (!needsUpdate) {
                const testHandle = await initSQLitePersistent({ dbName: this.dbName });
                if (await testHandle.isEmpty()) needsUpdate = true;
                await testHandle.close();
            }

            if (needsUpdate) {
                logger.info("Init", hasUpdate ? "Update pending. Re-hydrating storage..." : "Storage empty. Downloading source...");
                const dbStream = await this._downloadSource();
                
                // Trực tiếp truyền ReadableStream vào VFS (importToPersistentStorage đã hỗ trợ Stream)
                await importToPersistentStorage(this.dbName, dbStream);
                logger.info("Init", "Database hydrated to persistent storage.");
            }

            // 2. Mở kết nối chính thức
            this.db = await initSQLitePersistent({ dbName: this.dbName });
            this.isInitializing = false;
            return true;

        } catch (e) {
            logger.error("Init", `Failed to init ${this.dbName}`, e);
            this.isInitializing = false;
            return false;
        }
    }

    async _waitForInit() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.db) {
                    clearInterval(interval);
                    resolve(true);
                } else if (!this.isInitializing) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 50);
        });
    }

    async _downloadSource() {
        // [STRATEGY] Try compressed format (.gz) first to save bandwidth
        const cleanUrl = this.zipUrl.startsWith('/') ? this.zipUrl.substring(1) : this.zipUrl;
        const rawDbUrl = cleanUrl.replace(".db.gz", ".db").replace(".db.zip", ".db");
        const currentHash = localStorage.getItem(`${this.dbName}_hash`) || Date.now();
        
        let response = null;
        let isGzRequest = false;

        // 1. Try Compressed (.gz) first
        if (cleanUrl.endsWith('.gz') && 'DecompressionStream' in window) {
            try {
                logger.info("Download", `Fetching Compressed: ${cleanUrl}`);
                const res = await fetch(`${cleanUrl}?v=${currentHash}`);
                if (res.ok) {
                    const contentType = res.headers.get("content-type");
                    if (!contentType || !contentType.includes("text/html")) {
                        response = res;
                        isGzRequest = true;
                    }
                }
            } catch (e) {}
        }

        // 2. Fallback to Raw DB
        if (!response) {
            try {
                logger.info("Download", `Trying raw DB: ${rawDbUrl}`);
                const res = await fetch(`${rawDbUrl}?v=${currentHash}`);
                if (res.ok) {
                    const contentType = res.headers.get("content-type");
                    if (!contentType || !contentType.includes("text/html")) {
                        response = res;
                        isGzRequest = false;
                    }
                }
            } catch (e) {}
        }

        if (!response) {
            throw new Error(`Failed to download valid database file for ${this.dbName}`);
        }

        // Peek first chunk to check Magic Header
        const reader = response.body.getReader();
        const { done, value } = await reader.read();
        
        if (done) throw new Error("Empty response body");

        let needsDecompression = false;
        if (value[0] === 0x1f && value[1] === 0x8b) {
            needsDecompression = true;
        } else if (value[0] === 0x53 && value[1] === 0x51) { 
            // "SQLite format 3" (0x53, 0x51) -> already decompressed or raw DB
            needsDecompression = false;
        } else {
            throw new Error(`Invalid file format received for ${this.dbName}. Expected GZIP or SQLite.`);
        }

        const combinedStream = new ReadableStream({
            start(controller) {
                controller.enqueue(value);
            },
            async pull(controller) {
                const { done, value } = await reader.read();
                if (done) {
                    controller.close();
                } else {
                    controller.enqueue(value);
                }
            },
            cancel() {
                reader.cancel();
            }
        });

        if (needsDecompression && isGzRequest) {
            logger.info("Download", "Using Native DecompressionStream (GZIP)");
            return combinedStream.pipeThrough(new DecompressionStream('gzip'));
        }

        logger.info("Download", "Using raw DB stream.");
        return combinedStream;
    }

    async _checkAndApplyUpdate() {
        if (!this.zipUrl) return false;
        try {
            // Remove leading slash if present to make it relative
            const cleanUrl = this.zipUrl.startsWith('/') ? this.zipUrl.substring(1) : this.zipUrl;
            const manifestUrl = cleanUrl.replace(".db.gz", ".json").replace(".db.zip", ".json");
            const res = await fetch(`${manifestUrl}?t=${Date.now()}`, { cache: "no-store" });
            if (!res.ok) return false; 
            
            const remoteData = await res.json();
            const remoteHash = remoteData.hash;
            const localHash = localStorage.getItem(`${this.dbName}_hash`);
            
            if (remoteHash && remoteHash !== localHash) {
                logger.info("Update", "New version detected. Marking for re-hydration...");
                localStorage.setItem(`${this.dbName}_hash`, remoteHash);
                return true;
            }
        } catch (e) {
            logger.warn("Update", "Failed to check for updates (Offline?), skipping check.");
        }
        return false;
    }

    async run(sql, params) {
        if (!this.db) await this.init();
        return await this.db.run(sql, params);
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
            logger.info("Close", `Closed connection to ${this.dbName}`);
        }
    }
}
