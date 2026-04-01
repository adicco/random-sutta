// Path: web/assets/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import { MemoryVFS } from '@journeyapps/wa-sqlite/src/examples/MemoryVFS.js';
import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite.mjs'; // <-- Changed to synchronous WASM
import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';

const getWasmUrl = () => {
    // Dùng URL đặc thù của Vite cho WASM
    return new URL('@journeyapps/wa-sqlite/dist/wa-sqlite.wasm?url', import.meta.url).href;
};

const wasmUrl = getWasmUrl();

export async function initSQLite(options) {
    const { path, vfsOptions, readonly, beforeOpen } = await options;
    
    const sqliteModule = await SQLiteESMFactory({
        locateFile: (file) => {
            if (file.endsWith('.wasm')) return wasmUrl;
            return file;
        }
    });

    const sqlite = Factory(sqliteModule);
    
    // Sử dụng MemoryVFS để nạp toàn bộ DB vào RAM. Siêu tốc và không gây lỗi Asyncify (Jetsam iOS).
    const memoryVfs = await MemoryVFS.create(path, sqliteModule);
    sqlite.vfs_register(memoryVfs, true); 

    if (beforeOpen) {
        await beforeOpen(sqlite, memoryVfs, path);
    }

    const db = await sqlite.open_v2(
        path,
        readonly ? SQLiteConstants.SQLITE_OPEN_READONLY : (SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_CREATE),
        memoryVfs.name
    );

    const core = {
        db, path, pointer: db, sqlite, sqliteModule, vfs: memoryVfs
    };

    return {
        ...core,
        run: (sql, params) => run(core, sql, params),
        close: () => sqlite.close(db)
    };
}

export function withExistDB(file) {
    return {
        beforeOpen: async (sqlite, memoryVfs, dbPath) => {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            const fileId = 12345; 
            const pOutFlags = new DataView(new ArrayBuffer(4));
            
            // Mở file ảo trên MemoryVFS
            const openResult = await memoryVfs.jOpen(dbPath, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
            
            if (openResult === SQLiteConstants.SQLITE_OK) {
                await memoryVfs.jTruncate(fileId, 0);
                await memoryVfs.jWrite(fileId, data, 0);
                await memoryVfs.jClose(fileId);
                console.log(`✅ Database ${dbPath} imported successfully to RAM (MemoryVFS).`);
            }
        }
    };
}

async function run(core, sql, params) {
    const { sqlite, db } = core;
    const results = [];
    for await (const stmt of sqlite.statements(db, sql)) {
        if (params) sqlite.bind_collection(stmt, params);
        const cols = sqlite.column_names(stmt);
        while (await sqlite.step(stmt) === SQLiteConstants.SQLITE_ROW) {
            const row = sqlite.row(stmt);
            results.push(Object.fromEntries(cols.map((key, i) => [key, row[i]])));
        }
    }
    return results;
}

export function useIdbStorage(dbName, options = {}) {
    const idbName = dbName.endsWith('.db') ? dbName : `${dbName}.db`;
    return {
        path: idbName,
        vfsOptions: { idbName, ...options },
        ...options
    };
}
