// Path: web/assets/modules/ui/managers/scroll_manager.js
import { SuttaController } from "core/sutta_controller.js";
import { CommentController } from "ui/components/popup/controllers/comment_controller.js";

export const ScrollManager = {
    init: function() {
        let scrollSaveTimer = null;
        let autoSwitchTimer = null;
        
        const handleScroll = () => {
            if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
            scrollSaveTimer = setTimeout(() => {
                SuttaController._saveProgress();
            }, 1500);

            if (autoSwitchTimer) clearTimeout(autoSwitchTimer);
            autoSwitchTimer = setTimeout(() => {
                CommentController.handleAutoSwitch();
            }, 100);
        };

        const reader = document.getElementById("reader-view");
        const landing = document.getElementById("landing-view");

        if (reader) reader.addEventListener("scroll", handleScroll, { passive: true });
        if (landing) landing.addEventListener("scroll", handleScroll, { passive: true });

        window.addEventListener("beforeunload", () => {
            SuttaController._saveProgress();
        });
    }
};
