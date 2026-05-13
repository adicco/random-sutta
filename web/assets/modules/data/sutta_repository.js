// Path: web/assets/modules/data/sutta_repository.js
import { SuttaDB } from './sutta_db.js';
import { getLogger } from 'utils/logger.js';
import { DictProvider } from 'lookup/dict_provider.js';

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
        const cleanUid = uid.toLowerCase().trim().replace(/\s/g, "");
        const results = await SuttaDB.query("SELECT book_id FROM metadata WHERE uid = ?", [cleanUid]);
        if (results.length > 0) {
            return [results[0].book_id, "none"];
        }
        return null;
    },

    async searchMetadata(query, limit = 30) {
        if (!query || query.length < 2) return [];
        
        // [FTS5] Prepare query
        const cleanQuery = query.replace(/[.*"':]/g, " ").trim();
        if (!cleanQuery) return [];
        
        const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);
        const normalizedQuery = cleanQuery.replace(/\s/g, "");
        
        // Match either the full phrase, the separated terms, or the normalized (no-space) version
        const ftsQuery = `("${cleanQuery}" OR (${terms.map(t => `${t}*`).join(' AND ')}) OR "${normalizedQuery}*")`;

        // [RANKING & CONTEXT] Join with metadata table to get type and target/parent info
        const phrase = cleanQuery.toLowerCase();
        const acronymSearch = `%${phrase}%`;

        const sql = `
            SELECT 
                m.uid, m.type, m.target_uid, m.parent_uid, m.hash_id,
                m.original_title, m.translated_title, m.blurb,
                t.original_title as target_original_title, t.translated_title as target_translated_title, t.blurb as target_blurb,
                p.original_title as parent_original_title, p.translated_title as parent_translated_title, p.blurb as parent_blurb,
                snippet(metadata_fts, -1, '<b>', '</b>', '...', 25) as snippet,
                (CASE 
                    WHEN m.uid = ? THEN 0
                    WHEN m.acronym LIKE ? THEN 1
                    WHEN (m.original_title LIKE '%' || ? || '%' OR m.translated_title LIKE '%' || ? || '%' OR m.blurb LIKE '%' || ? || '%') THEN 2
                    WHEN m.book_id IN ('dn', 'mn', 'sn', 'an', 'kp', 'dhp', 'ud', 'iti', 'snp', 'thag', 'thig') THEN 3
                    WHEN m.book_id LIKE 'pli-tv-%' THEN 4
                    WHEN m.book_id IN ('ds', 'dt', 'kv', 'pp', 'vb', 'ya', 'patthana') THEN 5
                    ELSE 6 
                END) as priority
            FROM metadata_fts f
            JOIN metadata m ON f.rowid = m.rowid
            LEFT JOIN metadata t ON m.target_uid = t.uid
            LEFT JOIN metadata p ON m.parent_uid = p.uid
            WHERE f.metadata_fts MATCH ? 
            ORDER BY priority, rank 
            LIMIT ?
        `;
        
        try {
            return await SuttaDB.query(sql, [
                normalizedQuery.toLowerCase(), 
                acronymSearch,
                phrase, phrase, phrase,
                ftsQuery, 
                limit
            ]);
        } catch (e) {
            logger.error("Search", "FTS5 query failed", e);
            return [];
        }
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

    /**
     * Cache cho author_priority để tránh query liên tục
     */
    _authorPriority: null,

    async _getAuthorPriority() {
        if (this._authorPriority) return this._authorPriority;

        try {
            const results = await SuttaDB.query("SELECT value FROM config WHERE key = 'author_priority'");
            if (results.length > 0) {
                this._authorPriority = JSON.parse(results[0].value);
                return this._authorPriority;
            }
        } catch (e) {
            logger.error("Failed to fetch author_priority", e);
        }
        return [];
    },

    async fetchContent(uid) {
        if (!uid) return null;

        // 1. Tìm book_id để biết nạp shard nào
        const loc = await this.resolveLocation(uid);
        if (!loc) return null;

        const [bookId] = loc;
        const category = this._getCategory(bookId);
        const priorityList = await this._getAuthorPriority();

        // 2. Query từ Content Shard tương ứng (Vertical Schema)
        const sql = "SELECT segment_id, type, lang, author_uid, content FROM content_segments WHERE sutta_uid = ? ORDER BY segment_order";
        const results = await SuttaDB.queryShard(category, sql, [uid]);

        if (results.length === 0) return null;

        const contentMap = {};
        // Lưu trữ tạm thời để so sánh độ ưu tiên: { segId: { author: 'sujato', score: 0, content: '...' } }
        const transTemp = {};

        for (const row of results) {
            const segId = row.segment_id;
            if (!contentMap[segId]) {
                contentMap[segId] = {};
            }

            const type = row.type;
            const author = row.author_uid;

            if (type === 'root') {
                contentMap[segId].pli = row.content;
            } else if (type === 'html') {
                contentMap[segId].html = row.content;
            } else if (type === 'comment') {
                contentMap[segId].comm = row.content;
            } else if (type === 'variant') {
                contentMap[segId].variant = row.content;
            } else if (type === 'reference') {
                contentMap[segId].reference = row.content;
            } else if (type === 'translation') {
                // Logic xử lý ưu tiên bản dịch
                const currentScore = priorityList.indexOf(author);
                const bestScoreSoFar = transTemp[segId] ? priorityList.indexOf(transTemp[segId].author) : 999;

                // Nếu author này có trong list và có điểm ưu tiên cao hơn (index thấp hơn)
                // Hoặc nếu chưa có bản dịch nào cho segment này
                if (currentScore !== -1 && (currentScore < (bestScoreSoFar === -1 ? 999 : bestScoreSoFar) || !transTemp[segId])) {
                    transTemp[segId] = { author: author, content: row.content };
                    contentMap[segId].eng = row.content;
                } else if (!transTemp[segId]) {
                    // Fallback nếu không có author nào trong list priority, lấy đại cái đầu tiên
                    transTemp[segId] = { author: author, content: row.content };
                    contentMap[segId].eng = row.content;
                }
            }
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
            await DictProvider.init();
            logger.info("DownloadAll", "✅ Dictionary cached.");
            // Tối ưu RAM: Đóng ngay sau khi cache xong
            await DictProvider.closeAll();
        } catch (e) {
            logger.warn("DownloadAll", "Failed to cache dictionary", e);
        }

        // 3. Nạp tất cả Shard nội dung đồng thời để Safari cache lại qua SW
        const shards = ['major', 'minor', 'vinaya', 'abhidhamma'];
        let shardCount = 0;
        
        logger.info("DownloadAll", "Fetching all content shards for offline use...");

        // [OFFLINE FIX] Load sequentially and prefetch without keeping connection open to prevent iOS out-of-memory crashes
        for (const category of shards) {
             await SuttaDB.prefetchShard(category, (loaded, total) => {
                 const base = (shardCount + 1) * 20;
                 if (onProgress) onProgress(base, 100);
             });
             // Không gọi SuttaDB.closeShard(category) ở đây vì prefetchShard không lưu vào RAM
             shardCount++;
        }

        logger.info("DownloadAll", "✅ All shards cached for offline.");
    }};
