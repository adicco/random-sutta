// Path: web/assets/modules/data/sutta_repository.js
import { SuttaDB } from './sutta_db.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("SuttaRepository");

export const SuttaRepository = {
    
    async init() {
        await SuttaDB.init();
    },

    /**
     * Xác định shard (category) dựa trên bookId
     */
    _getCategory(bookId) {
        if (!bookId) return "minor";
        const b = bookId.toLowerCase();
        if (['dn', 'mn', 'sn', 'an'].includes(b)) return "major";
        if (b.startsWith('pli-tv-')) return "vinaya";
        if (['ds', 'dt', 'kv', 'pp', 'vb', 'ya', 'patthana'].includes(b)) return "abhidhamma";
        return "minor";
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
        // Query Metadata từ Core DB
        const metaResults = await SuttaDB.query("SELECT * FROM metadata WHERE book_id = ?", [bookId]);
        if (metaResults.length === 0) return null;
        
        const meta = {};
        let rootTitle = "";
        
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
                children: r.children ? JSON.parse(r.children) : [],
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
            super_book_title: rootTitle || bookId
        };
    },

    async fetchContent(uid) {
        if (!uid) return null;

        // 1. Tìm book_id để biết nạp shard nào
        const loc = await this.resolveLocation(uid);
        if (!loc) return null;

        const [bookId] = loc;
        const category = this._get_category(bookId);

        // 2. Query từ Content Shard tương ứng (Vertical Schema)
        const sql = "SELECT segment_id, type, content FROM content_segments WHERE sutta_uid = ? ORDER BY segment_order";
        const results = await SuttaDB.queryShard(category, sql, [uid]);

        if (results.length === 0) return null;

        const contentMap = {};
        for (const row of results) {
            const segId = row.segment_id;
            if (!contentMap[segId]) {
                contentMap[segId] = {};
            }

            // Map types to legacy horizontal keys for UI compatibility
            if (row.type === 'root') contentMap[segId].pli = row.content;
            else if (row.type === 'translation') contentMap[segId].eng = row.content;
            else if (row.type === 'html') contentMap[segId].html = row.content;
            else if (row.type === 'comment') contentMap[segId].comm = row.content;
            else if (row.type === 'variant') contentMap[segId].variant = row.content;
            else if (row.type === 'reference') contentMap[segId].reference = row.content;
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
                children: r.children ? JSON.parse(r.children) : [],
                hash_id: r.hash_id,
                extract_id: r.extract_id,
                nav: { prev: r.nav_prev, next: r.nav_next }
            };
        }
        
        return results;
    },

    async downloadAll(onProgress) {
        // 1. Nạp Core Database (Metadata, Structure)
        await SuttaDB.init((loaded, total) => {
             if (onProgress) onProgress(loaded, total * 6); // 1 core + 4 shards + 1 dict = 6
        });
        
        // 2. Nạp từ điển (DPD) để Safari cache lại
        try {
            const { DictProvider } = await import('lookup/dict_provider.js');
            await DictProvider.init();
            logger.info("DownloadAll", "✅ Dictionary cached.");
        } catch (e) {
            logger.warn("DownloadAll", "Failed to cache dictionary", e);
        }

        // 3. Nạp tất cả Shard nội dung đồng thời để Safari cache lại qua SW
        const shards = ['major', 'minor', 'vinaya', 'abhidhamma'];
        let shardCount = 0;
        
        logger.info("DownloadAll", "Fetching all content shards for offline use...");

        // [OFFLINE FIX] Load sequentially to prevent iOS out-of-memory crashes
        for (const category of shards) {
             await SuttaDB.loadShard(category, (loaded, total) => {
                 // Logic progress đơn giản: Coi mỗi shard là 1/5 tổng tiến trình
                 const base = (shardCount + 1) * 20;
                 if (onProgress) onProgress(base, 100);
             });
             shardCount++;
        }

        logger.info("DownloadAll", "✅ All shards cached for offline.");
        }};
