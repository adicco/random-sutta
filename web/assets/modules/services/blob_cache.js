// Path: web/assets/modules/services/blob_cache.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("BlobCache");
const DB_NAME = "SuttaBlobsDB";
const DB_VERSION = 1;
const STORE_BLOBS = "blobs";

export const BlobCache = {
    _db: null,

    async init() {
        if (this._db) return;
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                    db.createObjectStore(STORE_BLOBS);
                }
            };
            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve();
            };
            request.onerror = (e) => {
                logger.warn("Init", "IDB BlobCache failed", e);
                resolve(); // Resolve to fallback gracefully
            };
            request.onblocked = () => {
                logger.warn("Init", "IDB BlobCache blocked");
                resolve();
            };
        });
    },

    async getBlob(key) {
        await this.init();
        if (!this._db) return null;
        return new Promise((resolve) => {
            try {
                const tx = this._db.transaction(STORE_BLOBS, 'readonly');
                const store = tx.objectStore(STORE_BLOBS);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
                tx.onabort = () => resolve(null);
                tx.onerror = () => resolve(null);
            } catch (e) {
                logger.warn("Get", `IDB error for ${key}`, e);
                resolve(null);
            }
        });
    },

    async setBlob(key, buffer) {
        await this.init();
        if (!this._db) return;
        return new Promise((resolve) => {
            try {
                const tx = this._db.transaction(STORE_BLOBS, 'readwrite');
                tx.onabort = (e) => {
                    logger.warn("Set", `Transaction aborted for ${key}`, e);
                    resolve();
                };
                tx.onerror = (e) => {
                    logger.warn("Set", `Transaction error for ${key}`, e);
                    resolve();
                };
                const store = tx.objectStore(STORE_BLOBS);
                const req = store.put(buffer, key);
                req.onsuccess = () => resolve();
                req.onerror = (e) => {
                    logger.warn("Set", `Failed to cache blob for ${key}`, e);
                    resolve();
                };
            } catch (e) {
                logger.warn("Set", `IDB error for ${key}`, e);
                resolve();
            }
        });
    },
    
    async clear() {
        await this.init();
        if (!this._db) return;
        return new Promise((resolve) => {
            try {
                const tx = this._db.transaction(STORE_BLOBS, 'readwrite');
                const store = tx.objectStore(STORE_BLOBS);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                tx.onabort = () => resolve();
                tx.onerror = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    }
};
