// Path: web/assets/modules/ui/managers/gesture_manager.js
import { getLogger } from "utils/logger.js";
const logger = getLogger("GestureManager");

export const GestureManager = {
    init() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        const swipeThreshold = 80; // min distance px
        const timeThreshold = 300; // max time ms

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return; // Ignore multi-touch
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 0) return;
            const touch = e.changedTouches[0];
            const touchEndX = touch.clientX;
            const touchEndY = touch.clientY;
            const touchEndTime = Date.now();

            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const deltaTime = touchEndTime - touchStartTime;

            // Must be a quick swipe
            if (deltaTime > timeThreshold) return;

            // Must be primarily horizontal
            if (Math.abs(deltaX) < Math.abs(deltaY) * 2) return;

            // Must cover minimum distance
            if (Math.abs(deltaX) < swipeThreshold) return;

            // 1. Swipe Right -> Go Back
            if (deltaX > swipeThreshold) {
                logger.debug("Gesture", "Navigating Back");
                window.history.back();
            }

            // 2. Swipe Left -> Go Forward
            if (deltaX < -swipeThreshold) {
                logger.debug("Gesture", "Navigating Forward");
                window.history.forward();
            }
        }, { passive: true });
        
        logger.info("Init", "GestureManager initialized.");
    }
};
