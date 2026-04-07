// Path: web/assets/modules/services/sqlite_connection.js
import { getLogger } from 'utils/logger.js';
import { initSQLite } from './sqlite_helper.js';
import JSZip from 'jszip';

const logger = getLogger("SqliteConnection");

export class SqliteConnection {
    constructor(dbName, zipUrl) {
        this.dbName = dbName;
        this.zipUrl = zipUrl; // E.g. assets/db/dictionaries/dpd_mini.db.zip
        this.db = null;
        this.isInitializing = false;
    }

    async init() {
        if (this.db) return true;
        if (this.isInitializing) return this._waitForInit();

        this.isInitializing = true;
        try {
            const hasUpdate = await this._checkAndApplyUpdate();

            logger.info("Init", `Initializing ${this.dbName} in RAM...`);
            
            let dbHandle = await initSQLite({
                path: this.dbName
            });
            
            // 2. Check if DB has tables AND no update was pending
            const tables = await dbHandle.run("SELECT name FROM sqlite_master WHERE type='table'");
            
            // 3. If empty OR we just detected an update, download and hydrate
            if (tables.length === 0 || hasUpdate) {
                logger.info("Init", hasUpdate ? "Update pending. Re-hydrating RAM..." : "RAM DB empty. Downloading source...");
                await dbHandle.close();
                
                const dbBinary = await this._downloadSource();
                const dbFile = new File([dbBinary], this.dbName, { type: 'application/x-sqlite3' });
                
                dbHandle = await initSQLite({
                    path: this.dbName,
                    file: dbFile
                });
                logger.info("Init", "Database hydrated to RAM.");
            }

            this.db = dbHandle;
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
                }
            }, 50);
        });
    }

    async _downloadSource() {
        // [STRATEGY] Try raw .db first, fallback to .zip
        const rawDbUrl = this.zipUrl.replace(".db.zip", ".db");
        const currentHash = localStorage.getItem(`${this.dbName}_hash`) || Date.now();
        
        try {
            logger.info("Download", `Trying raw DB: ${rawDbUrl}`);
            const resp = await fetch(`${rawDbUrl}?v=${currentHash}`);
            if (resp.ok) {
                const buffer = await resp.arrayBuffer();
                // [NEW] Verify Magic Header: "SQLite format 3"
                const header = new Uint8Array(buffer.slice(0, 16));
                const magic = String.fromCharCode(...header.slice(0, 15));
                if (magic === "SQLite format 3") {
                    logger.info("Download", "Raw DB verified. Using direct buffer.");
                    return buffer;
                } else {
                    logger.warn("Download", "Raw DB verification failed (Not a SQLite file). Falling back to ZIP.");
                }
            }
        } catch (e) {
            logger.warn("Download", "Raw DB fetch failed, falling back to ZIP");
        }

        // Fallback to ZIP
        logger.info("Download", `Fetching ZIP: ${this.zipUrl}`);
        const response = await fetch(`${this.zipUrl}?v=${currentHash}`);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const dbFile = zip.file(this.dbName); 
        if (!dbFile) throw new Error(`${this.dbName} not found in zip`);
        return await dbFile.async("arraybuffer");
    }

    async _checkAndApplyUpdate() {
        if (!this.zipUrl) return false;
        try {
            const manifestUrl = this.zipUrl.replace(".db.zip", ".json");
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
        } catch (e) {}
        return false;
    }

    async run(sql, params) {
        if (!this.db) await this.init();
        return await this.db.run(sql, params);
    }
}
