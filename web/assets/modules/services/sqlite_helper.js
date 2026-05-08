// Path: web/assets/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import { IDBBatchAtomicVFS } from '@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs'; 
import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';

const wasmUrlAsync = new URL('@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm?url', import.meta.url).href;

// --- MONKEY PATCH VFS ---
// Fix for: TypeError: Cannot read properties of undefined (reading 'flags') at _IDBBatchAtomicVFS.jClose
// This happens when open_v2 fails and tries to close a file that wasn't successfully registered.
const originalJClose = IDBBatchAtomicVFS.prototype.jClose;
IDBBatchAtomicVFS.prototype.jClose = async function(fileId) {
    if (!this.mapIdToFile || !this.mapIdToFile.has(fileId)) {
        return SQLiteConstants.SQLITE_OK;
    }
    return originalJClose.call(this, fileId);
};

// --- SINGLETON STATE & MUTEX ---
let initPromise = null;
let globalLock = Promise.resolve();

/**
 * Mutex để đảm bảo các thao tác SQLite (Mở, Ghi, Truy vấn nhạy cảm) không chạy song song.
 * Đặc biệt quan trọng trên iOS/Safari để tránh "memory access out of bounds".
 */
async function withLock(fn) {
    const prevLock = globalLock;
    let release;
    globalLock = new Promise(res => { release = res; });
    await prevLock;
    try {
        return await fn();
    } finally {
        release();
    }
}

async function getSharedSqlite() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const sqliteModule = await SQLiteESMFactory({ 
            locateFile: (file) => file.endsWith('.wasm') ? wasmUrlAsync : file 
        });
        const sqlite = Factory(sqliteModule);
        
        // Tạo một VFS chung cho toàn bộ App
        const vfs = new IDBBatchAtomicVFS("RS_Persistent_Storage", sqliteModule);
        sqlite.vfs_register(vfs, true); 

        return { sqlite, vfs };
    })();

    return initPromise;
}

/**
 * Ghi dữ liệu thô vào VFS mà không cần mở kết nối SQLite.
 */
export async function importToPersistentStorage(dbName, file) {
    return withLock(async () => {
        const { vfs } = await getSharedSqlite();
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        
        // Dùng một fileId an toàn (không trùng với pointer của WASM)
        // Trong wa-sqlite, fileId thường là pointer (> 0). 
        // Ta dùng một số âm hoặc số rất lớn để tránh xung đột nếu gọi trực tiếp VFS.
        const fileId = 0x7FFFFFFF; 
        const pOutFlags = new DataView(new ArrayBuffer(4));
        
        const res = await vfs.jOpen(dbName, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
        if (res === SQLiteConstants.SQLITE_OK) {
            await vfs.jTruncate(fileId, 0);
            await vfs.jWrite(fileId, data, 0);
            await vfs.jClose(fileId);
            console.log(`✅ [VFS] Data written: ${dbName} (${Math.round(data.byteLength/1024/1024)} MB)`);
            return true;
        }
        return false;
    });
}

/**
 * Mở kết nối SQLite tới một DB trong Persistent Storage.
 */
export async function initSQLitePersistent(options) {
    return withLock(async () => {
        const { dbName } = options;
        const { sqlite, vfs } = await getSharedSqlite();

        try {
            const db = await sqlite.open_v2(
                dbName,
                SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_CREATE,
                vfs.name
            );

            if (!db) throw new Error(`❌ Failed to open database: ${dbName}`);

            // Tối ưu RAM cho iOS (Jetsam safe)
            await run_internal(sqlite, db, "PRAGMA journal_mode = DELETE");
            await run_internal(sqlite, db, "PRAGMA synchronous = NORMAL");
            await run_internal(sqlite, db, "PRAGMA cache_size = -1000"); // 1MB cache per DB
            await run_internal(sqlite, db, "PRAGMA temp_store = MEMORY");

            const core = { db, path: dbName, pointer: db, sqlite, vfs };
            return {
                ...core,
                run: (sql, params) => run(core, sql, params),
                close: async () => {
                    await withLock(async () => {
                        await sqlite.close(db);
                    });
                },
                isEmpty: async () => {
                    try {
                        const res = await run(core, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1");
                        return res.length === 0;
                    } catch (e) { return true; }
                }
            };
        } catch (e) {
            console.error(`❌ [SQLite] Failed to open ${dbName}:`, e);
            throw e;
        }
    });
}

async function run_internal(sqlite, db, sql) {
    for await (const stmt of sqlite.statements(db, sql)) {
        await sqlite.step(stmt);
    }
}

async function run(core, sql, params) {
    const { sqlite, db } = core;
    const results = [];
    try {
        for await (const stmt of sqlite.statements(db, sql)) {
            if (params) {
                if (Array.isArray(params)) {
                    sqlite.bind_collection(stmt, params);
                } else {
                    for (const [key, value] of Object.entries(params)) {
                        const idx = sqlite.bind_parameter_index(stmt, key);
                        if (idx > 0) sqlite.bind_text(stmt, idx, value);
                    }
                }
            }
            
            const cols = sqlite.column_names(stmt);
            while (await sqlite.step(stmt) === SQLiteConstants.SQLITE_ROW) {
                const row = sqlite.row(stmt);
                results.push(Object.fromEntries(cols.map((key, i) => [key, row[i]])));
            }
        }
    } catch (e) {
        console.error(`❌ SQLite Query Error [${core.path}]:`, e, sql);
        // Nếu lỗi là "memory access out of bounds", thông báo reload
        if (e.message?.includes("memory access out of bounds")) {
            console.error("🚨 Critical WASM Memory Error. App requires reload.");
        }
    }
    return results;
}

