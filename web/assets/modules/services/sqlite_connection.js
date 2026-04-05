// Path: web/assets/modules/services/sqlite_connection.js
import { getLogger } from 'utils/logger.js';
import { initSQLite, withExistDB, useIdbStorage } from './sqlite_helper.js';
import JSZip from 'jszip';

const logger = getLogger("SqliteConnection");

export class SqliteConnection {
    constructor(dbName, zipUrl) {
        this.dbName = dbName;
        this.zipUrl = zipUrl;
        this.db = null;
        this.isInitializing = false;
    }

    async init(retries = 1) {
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
            // [NEW] Auto-Update Check
            await this._checkAndApplyUpdate();

            logger.info("Init", `Initializing ${this.dbName}...`);
            
            // Try to open the DB
            let dbHandle = await initSQLite(useIdbStorage(this.dbName));
            
            // Check if table population is needed
            const tables = await dbHandle.run("SELECT name FROM sqlite_master WHERE type='table'");
            
            // If DB is empty and we have a zipUrl, assume we need to load it.
            if (tables.length === 0 && this.zipUrl) {
                logger.info("Init", "DB empty. Downloading & Hydrating...");
                await dbHandle.close();
                
                const dbBinary = await this._downloadAndUnzip();
                const dbFile = new File([dbBinary], this.dbName, { type: 'application/x-sqlite3' });
                
                dbHandle = await initSQLite(useIdbStorage(this.dbName, withExistDB(dbFile)));
                logger.info("Init", "Database restored to IndexedDB.");
            } else {
                logger.info("Init", "Loaded existing DB.");
            }

            this.db = dbHandle;
            this.isInitializing = false;
            return true;

        } catch (e) {
            logger.error("Init", `Failed to init ${this.dbName}`, e);
            if (retries > 0) {
                logger.warn("Init", "Attempting recovery: Deleting DB and retrying...");
                await this._deleteDB();
                this.isInitializing = false;
                return await this.init(retries - 1);
            }
            this.isInitializing = false;
            return false;
        }
    }

    async resetDatabase() {
        logger.warn("Reset", `Force resetting database ${this.dbName}...`);
        await this._deleteDB();
        localStorage.removeItem(`${this.dbName}_hash`);
    }

    async _checkAndApplyUpdate() {
        if (!this.zipUrl) return;
        
        try {
            const manifestUrl = this.zipUrl.replace(".db.zip", ".json");
            // Add timestamp to prevent caching of manifest itself
            const res = await fetch(`${manifestUrl}?t=${Date.now()}`, { cache: "no-store" });
            
            if (!res.ok) {
                logger.warn("Update", `Manifest check failed: ${res.status} ${res.statusText}`);
                return; 
            }
            
            const remoteData = await res.json();
            const remoteHash = remoteData.hash;
            const localHash = localStorage.getItem(`${this.dbName}_hash`);
            
            if (remoteHash && remoteHash !== localHash) {
                logger.info("Init", `Update found! Remote: ${remoteHash.substr(0,8)} != Local: ${localHash ? localHash.substr(0,8) : 'null'}`);
                await this._deleteDB();
                localStorage.setItem(`${this.dbName}_hash`, remoteHash);
            } else {
                logger.info("Init", "Database is up to date.");
            }
        } catch (e) {
            logger.warn("Init", "Update check failed", e);
        }
    }

    async _deleteDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(this.dbName);
            req.onsuccess = () => {
                logger.info("Init", "Deleted corrupted DB.");
                resolve();
            };
            req.onerror = () => reject(req.error);
            req.onblocked = () => {
                logger.warn("Init", "Delete blocked by other tabs.");
            };
        });
    }

    async _downloadAndUnzip() {
        if (!window.JSZip) throw new Error("JSZip not loaded");
        
        // [FIX] Cache Busting Strategy
        // 1. Use Hash from localStorage (set by _checkAndApplyUpdate) as version query
        // 2. Use cache: 'reload' to force network request
        const currentHash = localStorage.getItem(`${this.dbName}_hash`) || Date.now();
        const safeUrl = `${this.zipUrl}?v=${currentHash}`;
        
        logger.info("Download", `Fetching DB from: ${safeUrl}`);

        const response = await fetch(safeUrl, { cache: 'reload' });
        
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const dbFile = zip.file(this.dbName); 
        if (!dbFile) throw new Error(`${this.dbName} not found in zip`);
        return await dbFile.async("arraybuffer");
    }

    async run(sql, params) {
        if (!this.db) await this.init();
        return await this.db.run(sql, params);
    }
}
