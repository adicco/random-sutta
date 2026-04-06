import { getLogger } from 'utils/logger.js';
import { initSQLite, withExistDB, useIdbStorage } from 'services/sqlite_helper.js';

const logger = getLogger("SuttaDB");
const DB_NAME = "sutta_data.db";

export class SuttaDB {
    static db = null;
    static isInitializing = false;

    static async init() {
        if (this.db) return true;
        if (this.isInitializing) {
            return new Promise(resolve => {
                const interval = setInterval(() => {
                    if (this.db) {
                        clearInterval(interval);
                        resolve(true);
                    } else if (this.isInitializing === false) {
                        clearInterval(interval);
                        resolve(false);
                    }
                }, 100);
            });
        }

        this.isInitializing = true;
        try {
            logger.info("Init", `Initializing ${DB_NAME}...`);
            
            const dbVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "dev";
            const url = `/assets/db/${DB_NAME}?v=${dbVersion}`;
            
            let dbFile;
            const CACHE_NAME = `sutta-db-cache-v1`; // Stable cache name
            
            const fetchAndVerify = async (targetUrl) => {
                logger.info("Init", `Fetching ${DB_NAME} from network...`);
                const res = await fetch(targetUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${targetUrl}`);
                
                const buffer = await res.clone().arrayBuffer();
                if (buffer.byteLength < 16) throw new Error("File too small to be a database");
                
                const header = new Uint8Array(buffer.slice(0, 16));
                const magic = String.fromCharCode(...header.slice(0, 15));
                if (magic !== "SQLite format 3") {
                    throw new Error("File is not a valid SQLite database (Magic header mismatch)");
                }
                return res;
            };

            if ('caches' in window) {
                const cache = await caches.open(CACHE_NAME);
                let response = await cache.match(url);
                
                if (response) {
                    // Quick integrity check
                    try {
                        const buffer = await response.clone().arrayBuffer();
                        const header = new Uint8Array(buffer.slice(0, 16));
                        const magic = String.fromCharCode(...header.slice(0, 15));
                        if (magic !== "SQLite format 3") throw new Error("Corrupted cache");
                        logger.info("Init", "Loaded valid sutta_data.db from cache.");
                    } catch (e) {
                        logger.warn("Init", "Cache corrupted, redownloading...");
                        await cache.delete(url);
                        response = null;
                    }
                }

                if (!response) {
                    response = await fetchAndVerify(url);
                    await cache.put(url, response.clone());
                }
                
                const buffer = await response.arrayBuffer();
                dbFile = new File([buffer], DB_NAME, { type: 'application/x-sqlite3' });
            } else {
                const response = await fetchAndVerify(url);
                const buffer = await response.arrayBuffer();
                dbFile = new File([buffer], DB_NAME, { type: 'application/x-sqlite3' });
            }

            this.db = await initSQLite(useIdbStorage(DB_NAME, withExistDB(dbFile)));
            logger.info("Init", "Database loaded into MemoryVFS.");
            
            this.isInitializing = false;
            return true;
        } catch (e) {
            logger.error("Init", "Failed to initialize SuttaDB", e);
            this.isInitializing = false;
            return false;
        }
    }

    static async query(sql, params) {
        if (!this.db) await this.init();
        return await this.db.run(sql, params);
    }
}
