import { PRIMARY_BOOKS, SECONDARY_BOOKS, SUB_BOOKS } from 'data/constants.js';
import { getLogger } from 'utils/logger.js';
import { SuttaDB } from 'data/sutta_db.js';

const logger = getLogger("RandomHelper");

export const RandomHelper = {
    init() {},

    async getRandomPayload(activeFilters) {
        const rootBooks = (!activeFilters || activeFilters.length === 0) 
            ? [...PRIMARY_BOOKS, ...SECONDARY_BOOKS] 
            : activeFilters;
        
        const targetBookIds = [];
        for (const bookId of rootBooks) {
            if (SUB_BOOKS[bookId]) {
                for (const sub of SUB_BOOKS[bookId]) {
                    targetBookIds.push(sub);
                }
            } else {
                targetBookIds.push(bookId);
            }
        }

        if (targetBookIds.length === 0) return null;

        const placeholders = targetBookIds.map(() => '?').join(',');
        const sql = `SELECT book_id, sutta_uid FROM random_pools WHERE book_id IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`;
        
        try {
            const results = await SuttaDB.query(sql, targetBookIds);
            
            if (results.length > 0) {
                const row = results[0];
                logger.info("Random", `Selected: ${row.sutta_uid} from ${row.book_id}`);
                return {
                    uid: row.sutta_uid,
                    book_id: row.book_id
                };
            }
        } catch (e) {
            logger.error("Random", "Failed to fetch random sutta from DB", e);
        }

        return null;
    }
};
