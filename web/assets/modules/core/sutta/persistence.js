// Path: web/assets/modules/core/sutta/persistence.js
import { Scroller } from "ui/common/scroller.js";
import { getLogger } from "utils/logger.js";

const logger = getLogger("SuttaPersistence");
const STORAGE_KEY = "last_read_sutta";

export const SuttaPersistence = {
  isRestoring: false,

  /**
   * Save current reading progress to localStorage
   */
  save(id, scrollY) {
    if (this.isRestoring && scrollY === undefined) {
      logger.debug("Save skipped: Restoration in progress");
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const uid = id || params.get("q");
      if (!uid) return;

      const currentScroll = (scrollY !== undefined) ? Math.round(scrollY) : Math.round(Scroller.getScrollTop());
      
      const existing = this.load();
      
      // If same UID and same scroll (within 1px tolerance), don't update timestamp
      if (existing && existing.uid === uid && Math.abs(existing.scrollY - currentScroll) < 2) {
          return; 
      }

      const progress = {
        uid: uid,
        scrollY: currentScroll,
        timestamp: Date.now()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      window.dispatchEvent(new CustomEvent("local-data-changed"));
      logger.debug(`Saved: ${uid} at ${currentScroll}`);
    } catch (e) {
      console.warn("Could not save progress:", e);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      
      const data = JSON.parse(saved);
      
      // [MIGRATION] Handle old 'id' format
      if (data && data.id && !data.uid) {
          data.uid = data.id;
          delete data.id;
          // Save back migrated format
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      
      return data;
    } catch (e) {
      return null;
    }
  },

  startRestoring() {
    this.isRestoring = true;
  },

  endRestoring() {
    // Clear guard after a short delay to allow UI to settle
    setTimeout(() => { this.isRestoring = false; }, 500);
  }
};
