// Path: web/assets/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';

// WASM Assets
const wasmUrlSync = new URL('@journeyapps/wa-sqlite/dist/wa-sqlite.wasm?url', import.meta.url).href;
const wasmUrlAsync = new URL('@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm?url', import.meta.url).href;

// Cache Module Promises
let syncModulePromise = null;
let asyncModulePromise = null;

async function getSqliteModule(useMemory) {
    if (useMemory) {
        if (!syncModulePromise) {
            syncModulePromise = (async () => {
                const { default: factory } = await import('@journeyapps/wa-sqlite/dist/wa-sqlite.mjs');
                return factory({ locateFile: (file) => file.endsWith('.wasm') ? wasmUrlSync : file });
            })();
        }
        return syncModulePromise;
    } else {
        if (!asyncModulePromise) {
            asyncModulePromise = (async () => {
                const { default: factory } = await import('@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs');
                return factory({ locateFile: (file) => file.endsWith('.wasm') ? wasmUrlAsync : file });
            })();
        }
        return asyncModulePromise;
    }
}

/**
 * Khởi tạo SQLite Instance.
 */
export async function initSQLite(options) {
    let { path, useMemory = true, file, beforeOpen } = options;
    
    // 1. Chuẩn hóa đường dẫn cho OPFS (Yêu cầu có / để tránh lỗi regex trong wa-sqlite VFS)
    if (!useMemory && !path.startsWith('/')) {
        path = `/dbs/${path}`;
    }

    // 2. Load Module & VFS Class
    const sqliteModule = await getSqliteModule(useMemory);
    const sqlite = Factory(sqliteModule);
    
    let vfsClass;
    if (useMemory) {
        const { MemoryVFS } = await import('@journeyapps/wa-sqlite/src/examples/MemoryVFS.js');
        vfsClass = MemoryVFS;
    } else {
        const { OPFSAnyContextVFS } = await import('@journeyapps/wa-sqlite/src/examples/OPFSAnyContextVFS.js');
        vfsClass = OPFSAnyContextVFS;
    }

    // 3. Register VFS (Dùng tên path làm tên VFS để tránh xung đột giữa các shard)
    const vfs = await vfsClass.create(path, sqliteModule);
    sqlite.vfs_register(vfs, true); 

    if (beforeOpen) await beforeOpen(sqlite, vfs, path);

    // 4. Hydrate Data
    if (file) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        
        if (useMemory) {
            const fileId = Math.floor(Math.random() * 1000000);
            const pOutFlags = new DataView(new ArrayBuffer(4));
            const res = await vfs.jOpen(path, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
            if (res === SQLiteConstants.SQLITE_OK) {
                await vfs.jTruncate(fileId, 0);
                await vfs.jWrite(fileId, data, 0);
                await vfs.jClose(fileId);
                console.log(`✅ [MemoryVFS] Hydrated: ${path}`);
            }
        } else {
            await writeToOPFS(path, data);
            console.log(`✅ [OPFS] Hydrated: ${path}`);
        }
    }

    // 5. Open Database
    // Lưu ý: open_v2 của wa-sqlite trả về pointer trực tiếp qua Promise
    const db = await sqlite.open_v2(
        path,
        SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_CREATE,
        vfs.name
    );

    if (!db) {
        throw new Error(`❌ Failed to open database: ${path}`);
    }

    const core = { db, path, pointer: db, sqlite, sqliteModule, vfs };
    return {
        ...core,
        run: (sql, params) => run(core, sql, params),
        close: () => sqlite.close(db)
    };
}

/**
 * Ghi dữ liệu vào OPFS theo cấu trúc thư mục.
 */
async function writeToOPFS(path, data) {
    const parts = path.split('/').filter(p => p);
    const filename = parts.pop();
    let dir = await navigator.storage.getDirectory();
    
    for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
    }
    
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
}

/**
 * Thực thi câu lệnh SQL.
 */
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
        console.error(`❌ SQLite Query Error [${core.path}]:`, e, sql);
    }
    return results;
}

export function withExistDB(file) {
    return {
        beforeOpen: async (sqlite, vfs, dbPath) => {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            const fileId = 12345; 
            const pOutFlags = new DataView(new ArrayBuffer(4));
            const openResult = await vfs.jOpen(dbPath, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
            if (openResult === SQLiteConstants.SQLITE_OK) {
                await vfs.jTruncate(fileId, 0);
                await vfs.jWrite(fileId, data, 0);
                await vfs.jClose(fileId);
            }
        }
    };
}

export function useIdbStorage(dbName, options = {}) {
    return { path: dbName, useMemory: true, ...options };
}
