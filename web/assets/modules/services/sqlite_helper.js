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
 * Khởi tạo SQLite Instance sử dụng MemoryVFS (Đồng bộ, Tốc độ cao, Không Asyncify).
 */
export async function initSQLite(options) {
    let { path, file } = options;
    
    // 1. Chuẩn hóa đường dẫn
    if (!path.startsWith('/')) path = `/${path}`; 

    // 2. Load Module & VFS Class
    const sqliteModule = await getSqliteModule();
    const sqlite = Factory(sqliteModule);
    const vfs = await MemoryVFS.create(path, sqliteModule);
    sqlite.vfs_register(vfs, true); 

    // 3. Hydrate Data trực tiếp vào MemoryVFS
    if (file) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const fileId = Math.floor(Math.random() * 1000000);
        const pOutFlags = new DataView(new ArrayBuffer(4));
        const res = await vfs.jOpen(path, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
        if (res === SQLiteConstants.SQLITE_OK) {
            await vfs.jTruncate(fileId, 0);
            await vfs.jWrite(fileId, data, 0);
            await vfs.jClose(fileId);
            console.log(`✅ [MemoryVFS] Hydrated ${path} (${Math.round(data.byteLength/1024/1024)} MB)`);
        }
    }

    // 4. Open Database
    const db = await sqlite.open_v2(
        path,
        SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_CREATE,
        vfs.name
    );

    if (!db) throw new Error(`❌ Failed to open database: ${path}`);

    const core = { db, path, pointer: db, sqlite, sqliteModule, vfs };
    return {
        ...core,
        run: (sql, params) => run(core, sql, params),
        close: async () => {
            await sqlite.close(db);
            // Có thể cần gọi VFS jDelete nếu muốn giải phóng RAM hoàn toàn sau này
        }
    };
}

/**
 * Thực thi câu lệnh SQL (Chế độ đồng bộ/Sync).
 */
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

export function withExistDB(file) {
    return { file }; 
}

export function useIdbStorage(dbName, options = {}) {
    return { path: dbName, ...options };
}
