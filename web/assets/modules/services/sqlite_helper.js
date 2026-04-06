// Path: web/assets/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import { MemoryVFS } from '@journeyapps/wa-sqlite/src/examples/MemoryVFS.js';
import { OPFSAnyContextVFS } from '@journeyapps/wa-sqlite/src/examples/OPFSAnyContextVFS.js';

// Import cả hai loại build: Sync và Async
import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite.mjs'; 
import SQLiteAsyncESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs';

import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';

const getWasmUrl = (isAsync) => {
    const fileName = isAsync ? 'wa-sqlite-async.wasm' : 'wa-sqlite.wasm';
    return new URL(`@journeyapps/wa-sqlite/dist/${fileName}?url`, import.meta.url).href;
};

/**
 * Khởi tạo SQLite Instance với VFS tùy chọn (Memory hoặc OPFS).
 */
export async function initSQLite(options) {
    const { path, useMemory = true, file, beforeOpen } = options;
    
    // Chọn đúng WASM Factory dựa trên mục đích sử dụng
    const factory = useMemory ? SQLiteESMFactory : SQLiteAsyncESMFactory;
    const wasmUrl = getWasmUrl(!useMemory);

    const sqliteModule = await factory({
        locateFile: (file) => {
            if (file.endsWith('.wasm')) return wasmUrl;
            return file;
        }
    });

    const sqlite = Factory(sqliteModule);
    let vfs;

    if (useMemory) {
        // [SYNC MODE] MemoryVFS: RAM-only, iOS Jetsam safe.
        vfs = await MemoryVFS.create(path, sqliteModule);
        sqlite.vfs_register(vfs, true); 

        if (beforeOpen) {
            await beforeOpen(sqlite, vfs, path);
        }

        if (file) {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            const fileId = 12345;
            const pOutFlags = new DataView(new ArrayBuffer(4));
            // MemoryVFS jOpen/jWrite trong bản build Sync vẫn gọi được từ JS
            const openResult = await vfs.jOpen(path, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
            if (openResult === SQLiteConstants.SQLITE_OK) {
                await vfs.jTruncate(fileId, 0);
                await vfs.jWrite(fileId, data, 0);
                await vfs.jClose(fileId);
                console.log(`✅ [MemoryVFS] Core DB loaded to RAM.`);
            }
        }
    } else {
        // [ASYNC MODE] OPFS: Disk-based, large files support.
        vfs = await OPFSAnyContextVFS.create(path, sqliteModule);
        sqlite.vfs_register(vfs, true);
        
        if (file) {
            try {
                const root = await navigator.storage.getDirectory();
                const handle = await root.getFileHandle(path, { create: true });
                const writable = await handle.createWritable();
                await writable.write(await file.arrayBuffer());
                await writable.close();
                console.log(`✅ [OPFS] Shard ${path} synced.`);
            } catch (e) {
                console.warn(`⚠️ OPFS sync failed for ${path}, falling back to existing data if any.`, e);
            }
        }
    }

    const db = await sqlite.open_v2(
        path,
        SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_CREATE,
        vfs.name
    );

    const core = { db, path, pointer: db, sqlite, sqliteModule, vfs };

    return {
        ...core,
        run: (sql, params) => run(core, sql, params),
        close: () => sqlite.close(db)
    };
}

/**
 * [BACKWARD COMPAT] Helper for existing DB hydration
 */
export function withExistDB(file) {
    return {
        beforeOpen: async (sqlite, memoryVfs, dbPath) => {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            const fileId = 12345; 
            const pOutFlags = new DataView(new ArrayBuffer(4));
            const openResult = await memoryVfs.jOpen(dbPath, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
            if (openResult === SQLiteConstants.SQLITE_OK) {
                await memoryVfs.jTruncate(fileId, 0);
                await memoryVfs.jWrite(fileId, data, 0);
                await memoryVfs.jClose(fileId);
                console.log(`✅ Legacy database ${dbPath} hydrated.`);
            }
        }
    };
}

export function useIdbStorage(dbName, options = {}) {
    return { path: dbName, useMemory: true, ...options };
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
                    for (const [key, val] of Object.entries(params)) {
                        const idx = sqlite.bind_parameter_index(stmt, `@${key}`) || sqlite.bind_parameter_index(stmt, `:${key}`);
                        if (idx > 0) sqlite.bind_text(stmt, idx, val);
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
        console.error("❌ SQLite Query Error:", e, sql);
    }
    return results;
}
