// Path: web/assets/modules/ui/managers/scroll_manager.js
import { SuttaController } from "core/sutta_controller.js";

export const ScrollManager = {
    init: function() {
        let scrollSaveTimer = null;
        
        window.addEventListener("scroll", () => {
            if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
            scrollSaveTimer = setTimeout(() => {
                SuttaController._saveProgress();
            }, 1500);
        }, { passive: true });

        window.addEventListener("beforeunload", () => {
            SuttaController._saveProgress();
        });
    }
};
