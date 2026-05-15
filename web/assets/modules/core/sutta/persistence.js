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
      const suttaId = id || params.get("q");
      if (!suttaId) return;

      const currentScroll = (scrollY !== undefined) ? scrollY : Scroller.getScrollTop();
      
      const progress = {
        id: suttaId,
        scrollY: currentScroll,
        timestamp: Date.now()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      window.dispatchEvent(new CustomEvent("local-data-changed"));
      logger.debug(`Saved: ${suttaId} at ${currentScroll}`);
    } catch (e) {
      console.warn("Could not save progress:", e);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
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
