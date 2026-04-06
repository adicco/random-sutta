import { SuttaDB } from './sutta_db.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("SuttaRepository");

export const SuttaRepository = {
    
    async init() {
        logger.info("Init", "Initializing SuttaDB...");
        await SuttaDB.init();
    },

    async resolveLocation(uid) {
        if (!uid) return null;
        const cleanUid = uid.toLowerCase().trim();
        
        const results = await SuttaDB.query("SELECT book_id FROM metadata WHERE uid = ?", [cleanUid]);
        if (results.length > 0) {
            return [results[0].book_id, "none"];
        }
        return null;
    },

    async fetchMeta(bookId) {
        const metaResults = await SuttaDB.query("SELECT * FROM metadata WHERE book_id = ?", [bookId]);
        if (metaResults.length === 0) return null;
        
        const meta = {};
        let rootTitle = "";
        let superBookTitle = "";
        
        for (const r of metaResults) {
            meta[r.uid] = {
                type: r.type,
                acronym: r.acronym,
                translated_title: r.translated_title,
                original_title: r.original_title,
                blurb: r.blurb,
                author_uid: r.author_uid,
                parent_uid: r.parent_uid,
                target_uid: r.target_uid,
                hash_id: r.hash_id,
                extract_id: r.extract_id,
                nav: { prev: r.nav_prev, next: r.nav_next }
            };
            if (r.uid === bookId) {
                rootTitle = r.translated_title || r.original_title || r.acronym;
            }
        }
        
        const structResults = await SuttaDB.query("SELECT tree_json FROM structure WHERE book_id = ?", [bookId]);
        let tree = {};
        if (structResults.length > 0) {
            tree = JSON.parse(structResults[0].tree_json);
        }
        
        return {
            meta: meta,
            tree: tree,
            title: rootTitle || bookId,
            super_book_title: superBookTitle || rootTitle || bookId
        };
    },

    async fetchContent(uid) {
        if (!uid) return null;
        const results = await SuttaDB.query("SELECT segment_id, pli, eng, html, comm FROM content_segments WHERE sutta_uid = ? ORDER BY segment_order", [uid]);
        if (results.length === 0) return null;
        
        const contentMap = {};
        for (const row of results) {
            contentMap[row.segment_id] = {
                pli: row.pli,
                eng: row.eng,
                html: row.html,
                comm: row.comm
            };
        }
        return contentMap;
    },

    async fetchMetaList(uids) {
        const uniqueIds = [...new Set(uids)].filter(id => id);
        if (uniqueIds.length === 0) return {};
        
        const placeholders = uniqueIds.map(() => '?').join(',');
        const metaResults = await SuttaDB.query(`SELECT * FROM metadata WHERE uid IN (${placeholders})`, uniqueIds);
        
        const results = {};
        for (const r of metaResults) {
            results[r.uid] = {
                type: r.type,
                acronym: r.acronym,
                translated_title: r.translated_title,
                original_title: r.original_title,
                blurb: r.blurb,
                author_uid: r.author_uid,
                parent_uid: r.parent_uid,
                target_uid: r.target_uid,
                hash_id: r.hash_id,
                extract_id: r.extract_id,
                nav: { prev: r.nav_prev, next: r.nav_next }
            };
        }
        
        return results;
    },

    async downloadAll(onProgress) {
        // Handled entirely by SuttaDB init via fetch & cache.
        if (onProgress) onProgress(100, 100);
    }
};
