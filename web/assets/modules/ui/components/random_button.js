// Path: web/assets/modules/ui/components/random_button.js
import { SuttaController } from "core/sutta_controller.js";
import { ViewManager } from "ui/managers/view_manager.js";

export const RandomButton = {
    init: function() {
        const randomBtn = document.getElementById("btn-random");
        const landingRandomBtn = document.getElementById("btn-landing-random");

        if (landingRandomBtn) {
            landingRandomBtn.addEventListener("click", () => {
                ViewManager.switchView('reader');
                SuttaController.loadRandomSutta(true);
            });
        }

        if (!randomBtn) return;

        let isLongPress = false;
        let pressTimer;

        const startPress = (e) => {
            // Only handle left click or touch
            if (e.type === 'mousedown' && e.button !== 0) return;
            
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                const popup = document.getElementById("filter-popup");
                if (popup) {
                    popup.style.zIndex = 1150; // Ensure it's above other things
                    popup.classList.remove("hidden");
                    if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback on open
                }
            }, 500);
        };

        const cancelPress = () => {
            if (pressTimer) clearTimeout(pressTimer);
        };

        // Prevent default context menu on mobile long press
        randomBtn.addEventListener("contextmenu", (e) => e.preventDefault());
        
        randomBtn.addEventListener("mousedown", startPress);
        randomBtn.addEventListener("touchstart", startPress, { passive: true });
        randomBtn.addEventListener("mouseup", cancelPress);
        randomBtn.addEventListener("mouseleave", cancelPress);
        randomBtn.addEventListener("touchend", cancelPress);
        randomBtn.addEventListener("touchcancel", cancelPress);

        randomBtn.addEventListener("click", (e) => {
            if (isLongPress) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            SuttaController.loadRandomSutta(true);
        });
    }
};
