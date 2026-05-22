// Path: web/assets/modules/services/sync/note_sync_service.js
import { getLogger } from "utils/logger.js";
import { GithubSync } from "services/sync/github_sync.js";
import { SuttaRepository } from "data/sutta_repository.js";

const logger = getLogger("NoteSyncService");

export const NoteSyncService = {
    /**
     * Get the note content for a specific sutta UID.
     * Path structure: notes/{book_id}/{uid}.md
     */
    async getNote(uid) {
        try {
            const loc = await SuttaRepository.resolveLocation(uid);
            if (!loc) throw new Error(`Could not resolve location for ${uid}`);
            
            const [bookId] = loc;
            const filePath = `notes/${bookId}/${uid}.md`;
            
            const result = await GithubSync.downloadData(filePath);
            if (result) {
                return {
                    content: result.data,
                    sha: result.sha,
                    path: filePath
                };
            }
            return null;
        } catch (e) {
            logger.warn("getNote", `Failed to fetch note for ${uid}: ${e.message}`);
            return null;
        }
    },

    /**
     * Save a note for a specific sutta UID.
     */
    async saveNote(uid, content, currentSha = null) {
        try {
            const loc = await SuttaRepository.resolveLocation(uid);
            if (!loc) throw new Error(`Could not resolve location for ${uid}`);
            
            const [bookId] = loc;
            const filePath = `notes/${bookId}/${uid}.md`;
            
            logger.info("saveNote", `Saving note to ${filePath}`);
            const newSha = await GithubSync.uploadData(content, currentSha, filePath);
            
            return newSha;
        } catch (e) {
            logger.error("saveNote", `Failed to save note for ${uid}: ${e.message}`);
            throw e;
        }
    }
};
