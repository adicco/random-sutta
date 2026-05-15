// Path: web/assets/modules/ui/managers/scroll_manager.js
import { SuttaController } from "core/sutta_controller.js";
import { CommentController } from "ui/components/popup/controllers/comment_controller.js";

export const ScrollManager = {
    init: function() {
        let scrollSaveTimer = null;
        let autoSwitchTimer = null;
        
        window.addEventListener("scroll", () => {
            if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
            scrollSaveTimer = setTimeout(() => {
                SuttaController._saveProgress();
            }, 1500);

            // [NEW] Auto-switch comment logic
            if (autoSwitchTimer) clearTimeout(autoSwitchTimer);
            autoSwitchTimer = setTimeout(() => {
                CommentController.handleAutoSwitch();
            }, 100); // Faster reaction for auto-switch
        }, { passive: true });

        window.addEventListener("beforeunload", () => {
            SuttaController._saveProgress();
        });
    }
};
