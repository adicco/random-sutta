import { PRIMARY_BOOKS, SECONDARY_BOOKS, SUB_BOOKS } from 'data/constants.js';
import { getLogger } from 'utils/logger.js';
import { SuttaDB } from 'data/sutta_db.js';
import { ReadManager } from 'ui/managers/read_manager.js';

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
        
        try {
            const countSql = `SELECT COUNT(*) as total FROM random_pools WHERE book_id IN (${placeholders})`;
            const countResults = await SuttaDB.query(countSql, targetBookIds);
            const total = countResults[0]?.total || 0;

            if (total === 0) return null;

            const MAX_RETRIES = 50; // Prevent infinite loops
            
            for (let i = 0; i < MAX_RETRIES; i++) {
                const randomOffset = Math.floor(Math.random() * total);
                const pickSql = `SELECT book_id, sutta_uid FROM random_pools WHERE book_id IN (${placeholders}) LIMIT 1 OFFSET ${randomOffset}`;
                const results = await SuttaDB.query(pickSql, targetBookIds);
                
                if (results.length > 0) {
                    const row = results[0];
                    const prob = ReadManager.getKeepProbability(row.sutta_uid);
                    
                    // Rejection Sampling
                    if (Math.random() <= prob) {
                        logger.info("Random", `Selected: ${row.sutta_uid} from ${row.book_id} (Offset: ${randomOffset}/${total}, Keep Prob: ${prob})`);
                        return {
                            uid: row.sutta_uid,
                            book_id: row.book_id
                        };
                    } else {
                        logger.debug("Random", `Rejected: ${row.sutta_uid} (Keep Prob: ${prob}). Retrying...`);
                    }
                }
            }
            
            // Fallback: If we hit max retries, just pick one regardless of familiarity
            const randomOffset = Math.floor(Math.random() * total);
            const pickSql = `SELECT book_id, sutta_uid FROM random_pools WHERE book_id IN (${placeholders}) LIMIT 1 OFFSET ${randomOffset}`;
            const results = await SuttaDB.query(pickSql, targetBookIds);
            if (results.length > 0) {
                const row = results[0];
                logger.warn("Random", `Max retries hit. Forced selection: ${row.sutta_uid}`);
                return { uid: row.sutta_uid, book_id: row.book_id };
            }

        } catch (e) {
            logger.error("Random", "Failed to fetch random sutta from DB", e);
        }

        return null;
    }
};
