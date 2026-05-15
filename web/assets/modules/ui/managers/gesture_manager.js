// Path: web/assets/modules/ui/managers/gesture_manager.js
import { getLogger } from "utils/logger.js";
const logger = getLogger("GestureManager");

export const GestureManager = {
    init() {
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        const swipeThreshold = 80; // min distance px
        const timeThreshold = 300; // max time ms
        const edgeTapThreshold = 45; // px from edge for taps
        const tapTimeThreshold = 300; // max time for a tap

        const handleStart = (x, y, target) => {
            const isInsidePopup = target.closest('.popup-container');
            const isInsideDrawer = target.closest('#setting-drawer, #magic-toc-drawer');
            
            if (isInsidePopup || isInsideDrawer) {
                startX = -1; 
                return;
            }

            startX = x;
            startY = y;
            startTime = Date.now();
        };

        const handleEnd = (endX, endY, target) => {
            if (startX === -1) return;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const deltaTime = Date.now() - startTime;
            const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const windowWidth = window.innerWidth;

            // 1. Swipe Navigation (Main container only)
            if (deltaTime > timeThreshold) return;
            if (Math.abs(deltaX) < Math.abs(deltaY) * 2) return;
            if (Math.abs(deltaX) < swipeThreshold) return;

            const startTarget = document.elementFromPoint(startX, startY);
            if (!startTarget || !startTarget.closest('#sutta-container')) return;

            if (deltaX > swipeThreshold) {
                logger.debug("Gesture", "History Back");
                window.history.back();
            } else if (deltaX < -swipeThreshold) {
                logger.debug("Gesture", "History Forward");
                window.history.forward();
            }
        };

        // Touch Listeners
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            handleStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 0) return;
            handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.target);
        }, { passive: true });

        // Mouse Listeners (Desktop support)
        document.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click
            handleStart(e.clientX, e.clientY, e.target);
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button !== 0) return;
            handleEnd(e.clientX, e.clientY, e.target);
        });
        
        // --- Explicit Invisible Edge Buttons ---
        const edgeLeft = document.getElementById("edge-nav-left");
        const edgeRight = document.getElementById("edge-nav-right");
        const toggleEdgeNav = document.getElementById("toggle-edge-nav");

        // Load setting
        const EDGE_NAV_KEY = "setting_edge_nav_enabled";
        let edgeNavEnabled = localStorage.getItem(EDGE_NAV_KEY) !== "false"; // Default true
        
        if (toggleEdgeNav) {
            toggleEdgeNav.checked = edgeNavEnabled;
            toggleEdgeNav.addEventListener("change", (e) => {
                edgeNavEnabled = e.target.checked;
                localStorage.setItem(EDGE_NAV_KEY, edgeNavEnabled);
                logger.info("Settings", `Edge Nav ${edgeNavEnabled ? 'Enabled' : 'Disabled'}`);
            });
        }

        if (edgeLeft) {
            edgeLeft.addEventListener("click", () => {
                if (!edgeNavEnabled) return;
                const btnPrev = document.getElementById("nav-prev");
                if (btnPrev && !btnPrev.disabled) {
                    logger.debug("EdgeBtn", "Prev Sutta");
                    const success = window.SuttaController?.navigatePrev();
                    if (success) {
                        btnPrev.classList.add("active");
                        setTimeout(() => btnPrev.classList.remove("active"), 150);
                    }
                }
            });
        }

        if (edgeRight) {
            edgeRight.addEventListener("click", () => {
                if (!edgeNavEnabled) return;
                const btnNext = document.getElementById("nav-next");
                if (btnNext && !btnNext.disabled) {
                    logger.debug("EdgeBtn", "Next Sutta");
                    const success = window.SuttaController?.navigateNext();
                    if (success) {
                        btnNext.classList.add("active");
                        setTimeout(() => btnNext.classList.remove("active"), 150);
                    }
                }
            });
        }

        logger.info("Init", "GestureManager initialized (Touch + Mouse).");
    }
};
