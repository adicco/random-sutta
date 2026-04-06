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
            
            const dbVersion = window.__APP_VERSION__ || "dev";
            const url = `assets/db/${DB_NAME}?v=${dbVersion}`;
            
            let dbFile;
            
            if ('caches' in window) {
                const cacheName = `sutta-db-cache-${dbVersion}`;
                const cache = await caches.open(cacheName);
                let response = await cache.match(url);
                
                if (!response) {
                    logger.info("Init", `Downloading ${DB_NAME}...`);
                    response = await fetch(url);
                    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
                    await cache.put(url, response.clone());
                    
                    const keys = await caches.keys();
                    for (const key of keys) {
                        if (key.startsWith('sutta-db-cache-') && key !== cacheName) {
                            await caches.delete(key);
                        }
                    }
                } else {
                    logger.info("Init", `Loaded ${DB_NAME} from cache.`);
                }
                
                const buffer = await response.arrayBuffer();
                dbFile = new File([buffer], DB_NAME, { type: 'application/x-sqlite3' });
            } else {
                logger.info("Init", `Downloading ${DB_NAME} (No Cache API)...`);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch ${url}`);
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
