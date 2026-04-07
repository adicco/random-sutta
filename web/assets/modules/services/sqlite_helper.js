// Path: web/assets/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import { MemoryVFS } from '@journeyapps/wa-sqlite/src/examples/MemoryVFS.js';

// Import Sync build only for now
import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite.mjs'; 

import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';

const wasmUrlSync = new URL('@journeyapps/wa-sqlite/dist/wa-sqlite.wasm?url', import.meta.url).href;

/**
 * Khởi tạo SQLite Instance với VFS tùy chọn (Memory).
 */
export async function initSQLite(options) {
    const { path, useMemory = true, file, beforeOpen } = options;
    
    const sqliteModule = await SQLiteESMFactory({
        locateFile: (file) => {
            if (file.endsWith('.wasm')) return wasmUrlSync;
            return file;
        }
    });

    const sqlite = Factory(sqliteModule);
    let vfs;

    // Force MemoryVFS for now to debug
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
        const openResult = await vfs.jOpen(path, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
        if (openResult === SQLiteConstants.SQLITE_OK) {
            await vfs.jTruncate(fileId, 0);
            await vfs.jWrite(fileId, data, 0);
            await vfs.jClose(fileId);
            console.log(`✅ [MemoryVFS] DB loaded to RAM.`);
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
