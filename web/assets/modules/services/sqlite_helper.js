// Path: web/assets/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import { MemoryVFS } from '@journeyapps/wa-sqlite/src/examples/MemoryVFS.js';
import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite.mjs'; 
import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';

// Sử dụng WASM Sync tĩnh cho Vite
const wasmUrlSync = new URL('@journeyapps/wa-sqlite/dist/wa-sqlite.wasm?url', import.meta.url).href;

let syncModulePromise = null;

async function getSqliteModule() {
    if (!syncModulePromise) {
        syncModulePromise = (async () => {
            return SQLiteESMFactory({ locateFile: (file) => file.endsWith('.wasm') ? wasmUrlSync : file });
        })();
    }
    return syncModulePromise;
}

/**
 * Khởi tạo SQLite Instance sử dụng MemoryVFS (Đồng bộ, Tốc độ cao).
 */
export async function initSQLite(options) {
    let { path, file } = options;
    
    if (!path.startsWith('/')) path = `/${path}`; 

    const sqliteModule = await getSqliteModule();
    const sqlite = Factory(sqliteModule);
    const vfs = await MemoryVFS.create(path, sqliteModule);
    sqlite.vfs_register(vfs, true); 

    if (file) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const fileId = 12345;
        const pOutFlags = new DataView(new ArrayBuffer(4));
        const res = await vfs.jOpen(path, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
        if (res === SQLiteConstants.SQLITE_OK) {
            await vfs.jTruncate(fileId, 0);
            await vfs.jWrite(fileId, data, 0);
            await vfs.jClose(fileId);
            console.log(`✅ [MemoryVFS] Hydrated ${path} (${Math.round(data.byteLength/1024/1024)} MB)`);
        }
    }

    const db = await sqlite.open_v2(
        path,
        SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_CREATE,
        vfs.name
    );

    if (!db) throw new Error(`❌ Failed to open database: ${path}`);

    // [OPTIMIZATION] PRAGMA settings for RAM performance
    await run_internal(sqlite, db, "PRAGMA journal_mode = OFF");
    await run_internal(sqlite, db, "PRAGMA synchronous = OFF");
    await run_internal(sqlite, db, "PRAGMA temp_store = MEMORY");
    await run_internal(sqlite, db, "PRAGMA cache_size = -10000");

    const core = { db, path, pointer: db, sqlite, sqliteModule, vfs };
    return {
        ...core,
        run: (sql, params) => run(core, sql, params),
        close: async () => {
            await sqlite.close(db);
        }
    };
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
            if (params) sqlite.bind_collection(stmt, params);
            
            const cols = sqlite.column_names(stmt);
            while (await sqlite.step(stmt) === SQLiteConstants.SQLITE_ROW) {
                const row = sqlite.row(stmt);
                results.push(Object.fromEntries(cols.map((key, i) => [key, row[i]])));
            }
        }
    } catch (e) {
        console.error(`❌ SQLite Query Error [${core.path}]:`, e, sql);
    }
    return results;
}

export function withExistDB(file) { return { file }; }
export function useIdbStorage(dbName, options = {}) { return { path: dbName, ...options }; }
