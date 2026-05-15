// Path: web/assets/modules/ui/common/resize_handler.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("ResizeHandler");

export const ResizeHandler = {
    /**
     * Attaches vertical resizing logic to a popup element via a handle.
     * @param {HTMLElement} popup - The popup container to resize (height/bottom changes).
     * @param {HTMLElement} handle - The draggable handle (usually at the top edge).
     * @param {Object} options - Configuration and callbacks.
     * @param {string} options.storageKey - Key to persist the height in localStorage.
     * @param {string} options.cssVar - The CSS variable name to update (optional).
     * @param {number} options.minHeight - Minimum height in pixels (default 150).
     * @param {number} options.maxHeightVh - Maximum height in VH units (default 85).
     * @param {Function} options.onResize - Callback triggered during/after resize.
     */
    attach(popup, handle, options = {}) {
        if (!popup || !handle) return;

        const {
            storageKey = null,
            cssVar = null,
            minHeight = 150,
            maxHeightVh = 85,
            maxHeightPx = null, // Dynamic limit in pixels
            onResize = null
        } = options;

        let isResizing = false;
        let startY = 0;
        let startHeight = 0;

        // 1. Initialize height from storage
        if (storageKey) {
            const savedHeight = localStorage.getItem(storageKey);
            if (savedHeight) {
                const h = parseInt(savedHeight);
                // Apply safety limits to saved height
                const vhLimit = (window.innerHeight * maxHeightVh) / 100;
                
                // [FIX] Handle maxHeightPx if it's a function or number
                const currentMaxPx = (typeof maxHeightPx === 'function') 
                    ? maxHeightPx() 
                    : (maxHeightPx || vhLimit);

                const finalMax = Math.min(vhLimit, currentMaxPx);
                const safeH = Math.max(minHeight, Math.min(h, finalMax));
                
                popup.style.height = `${safeH}px`;
                if (cssVar) document.documentElement.style.setProperty(cssVar, `${safeH}px`);
                if (onResize) onResize(safeH);
            }
        }

        const startDragging = (e) => {
            isResizing = true;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            startHeight = popup.offsetHeight;
            
            // Disable transitions during resize for smoothness
            popup.style.transition = 'none';
            document.body.classList.add('is-resizing');
            
            e.preventDefault();
            e.stopPropagation();
        };

        const onDragging = (e) => {
            if (!isResizing) return;

            const currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = startY - currentY; // Moving UP = positive delta
            let newHeight = startHeight + deltaY;

            // Constraints
            const vhLimit = (window.innerHeight * maxHeightVh) / 100;
            // Use static option OR dynamic calculated limit
            const currentMaxPx = (typeof options.maxHeightPx === 'function') 
                ? options.maxHeightPx() 
                : (maxHeightPx || vhLimit);

            const finalMax = Math.min(vhLimit, currentMaxPx);

            if (newHeight < minHeight) newHeight = minHeight;
            if (newHeight > finalMax) newHeight = finalMax;

            const heightStr = `${newHeight}px`;
            popup.style.height = heightStr;
            popup.style.maxHeight = heightStr; // Sync max-height
            
            if (cssVar) {
                document.documentElement.style.setProperty(cssVar, heightStr);
            }

            if (onResize) onResize(newHeight);
        };

        const stopDragging = () => {
            if (!isResizing) return;
            isResizing = false;
            
            // Restore transitions
            popup.style.transition = '';
            document.body.classList.remove('is-resizing');

            if (storageKey) {
                localStorage.setItem(storageKey, popup.style.height);
            }
        };

        handle.addEventListener('mousedown', startDragging);
        handle.addEventListener('touchstart', startDragging, { passive: false });

        window.addEventListener('mousemove', onDragging);
        window.addEventListener('touchmove', onDragging, { passive: false });

        window.addEventListener('mouseup', stopDragging);
        window.addEventListener('touchend', stopDragging);
    }
};
