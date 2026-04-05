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
        const edgeTapThreshold = 50; // px from edge for taps
        const tapTimeThreshold = 250; // max time for a tap

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return; // Ignore multi-touch
            
            // [NEW] Restrict to sutta-container only
            const target = e.target;
            const isInsideSutta = target.closest('#sutta-container');
            const isInsidePopup = target.closest('.popup-container');
            
            if (!isInsideSutta || isInsidePopup) {
                touchStartX = -1; // Invalidate
                return;
            }

            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (touchStartX === -1) return; // Ignore invalidated starts
            if (e.changedTouches.length === 0) return;
            const touch = e.changedTouches[0];
            const touchEndX = touch.clientX;
            const touchEndY = touch.clientY;
            const touchEndTime = Date.now();

            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const deltaTime = touchEndTime - touchStartTime;
            const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            const windowWidth = window.innerWidth;

            // [NEW] 1. Quick Tap on Edges -> Navigate Next/Prev Sutta
            if (deltaTime < tapTimeThreshold && dist < 10) {
                // [FIX] Prevent conflict with word lookup or other interactive elements
                const target = e.target;
                if (target.closest('a, button, .comment-marker, .lookup-highlight')) return;

                // Check if tapping on a word
                let isWord = false;
                try {
                    let range;
                    if (document.caretRangeFromPoint) {
                        range = document.caretRangeFromPoint(touchEndX, touchEndY);
                    } else if (document.caretPositionFromPoint) {
                        const pos = document.caretPositionFromPoint(touchEndX, touchEndY);
                        if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                        }
                    }
                    
                    if (range && range.startContainer.nodeType === 3) {
                        const text = range.startContainer.textContent;
                        const offset = range.startOffset;
                        // If it's not a whitespace, consider it a word
                        if (text[offset] && /\S/.test(text[offset])) {
                            isWord = true;
                        }
                    }
                } catch (err) {}

                if (isWord) return;

                // Left Edge Tap -> Prev
                if (touchStartX <= edgeTapThreshold) {
                    const btnPrev = document.getElementById("nav-prev");
                    if (btnPrev && !btnPrev.disabled) {
                        logger.debug("EdgeTap", "Triggering Prev Sutta");
                        btnPrev.click();
                        return;
                    }
                }
                // Right Edge Tap -> Next
                if (touchStartX >= windowWidth - edgeTapThreshold) {
                    const btnNext = document.getElementById("nav-next");
                    if (btnNext && !btnNext.disabled) {
                        logger.debug("EdgeTap", "Triggering Next Sutta");
                        btnNext.click();
                        return;
                    }
                }
            }

            // 2. Quick Swipe -> History Navigation
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
