// Path: web/assets/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';

// WASM Assets (Static URLs for Vite)
const wasmUrlSync = new URL('@journeyapps/wa-sqlite/dist/wa-sqlite.wasm?url', import.meta.url).href;
const wasmUrlAsync = new URL('@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm?url', import.meta.url).href;

/**
 * Khởi tạo SQLite Instance với VFS tùy chọn (Memory hoặc OPFS).
 * @param {Object} options 
 * @param {string} options.path Đường dẫn/Tên DB
 * @param {boolean} options.useMemory Mặc định true (Sync/RAM), false (Async/OPFS)
 * @param {File} options.file File dữ liệu ban đầu (nếu có)
 */
export async function initSQLite(options) {
    const { path, useMemory = true, file, beforeOpen } = options;
    
    // 1. Dynamic Load VFS và Factory dựa trên chế độ
    let vfsClass, factory;
    if (useMemory) {
        const mod = await import('@journeyapps/wa-sqlite/src/examples/MemoryVFS.js');
        const facMod = await import('@journeyapps/wa-sqlite/dist/wa-sqlite.mjs');
        vfsClass = mod.MemoryVFS;
        factory = facMod.default;
    } else {
        const mod = await import('@journeyapps/wa-sqlite/src/examples/OPFSAnyContextVFS.js');
        const facMod = await import('@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs');
        vfsClass = mod.OPFSAnyContextVFS;
        factory = facMod.default;
    }

    const wasmUrl = useMemory ? wasmUrlSync : wasmUrlAsync;

    // 2. Initialize WASM Module
    const sqliteModule = await factory({
        locateFile: (file) => {
            if (file.endsWith('.wasm')) return wasmUrl;
            return file;
        }
    });

    const sqlite = Factory(sqliteModule);
    
    // 3. Register VFS
    const vfs = await vfsClass.create(path, sqliteModule);
    sqlite.vfs_register(vfs, true); 

    // [BACKWARD COMPAT] Legacy hooks
    if (beforeOpen) {
        await beforeOpen(sqlite, vfs, path);
    }

    // 4. Hydrate Data (nếu có file)
    if (file) {
        if (useMemory) {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            const fileId = 12345;
            const pOutFlags = new DataView(new ArrayBuffer(4));
            const openResult = await vfs.jOpen(path, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
            if (openResult === SQLiteConstants.SQLITE_OK) {
                await vfs.jTruncate(fileId, 0);
                await vfs.jWrite(fileId, data, 0);
                await vfs.jClose(fileId);
                console.log(`✅ [MemoryVFS] Hydrated ${path}`);
            }
        } else {
            try {
                // OPFS Hydration
                const root = await navigator.storage.getDirectory();
                const handle = await root.getFileHandle(path, { create: true });
                const writable = await handle.createWritable();
                await writable.write(await file.arrayBuffer());
                await writable.close();
                console.log(`✅ [OPFS] Hydrated ${path}`);
            } catch (e) {
                console.warn(`⚠️ OPFS hydration failed, using existing data.`, e);
            }
        }
    }

    // 5. Open Database
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
                sqlite.bind_collection(stmt, params);
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
