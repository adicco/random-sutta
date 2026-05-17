// Path: web/assets/modules/ui/common/resize_handler.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("ResizeHandler");

export const ResizeHandler = {
    /**
     * Generates a device-specific key suffix based on bucketed viewport dimensions.
     * Bucketing ensures stability (small resizes don't reset settings) 
     * while distinguishing between different device classes (Phone vs Tablet vs PC).
     */
    getDeviceSuffix() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isTouch = window.matchMedia("(pointer: coarse)").matches;
        
        // Round to nearest 100px to create stable "size buckets"
        const bucketW = Math.floor(w / 100) * 100;
        const bucketH = Math.floor(h / 100) * 100;
        
        const isLandscape = w > h;
        return `_v${bucketW}x${bucketH}_${isLandscape ? 'L' : 'P'}${isTouch ? '_T' : ''}`;
    },

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

        // [NEW] Use Device-Specific Storage Key
        const deviceStorageKey = storageKey ? `${storageKey}${this.getDeviceSuffix()}` : null;

        // 1. Initialize height from storage
        if (deviceStorageKey) {
            const savedHeight = localStorage.getItem(deviceStorageKey);
            if (savedHeight) {
                const h = parseInt(savedHeight);
                // Apply safety limits to saved height
                const vhLimit = (window.innerHeight * maxHeightVh) / 100;
                
                // Handle maxHeightPx if it's a function or number
                const currentMaxPx = (typeof maxHeightPx === 'function') 
                    ? maxHeightPx() 
                    : (maxHeightPx || vhLimit);

                const finalMax = Math.min(vhLimit, currentMaxPx);
                
                // If saved height is invalid for CURRENT screen (e.g. too large), discard it
                if (h > finalMax + 50 || h < minHeight - 20) {
                    logger.info("Init", "Saved height is incompatible with current screen, using default.");
                    // Optional: popup remains at CSS default
                } else {
                    const safeH = Math.max(minHeight, Math.min(h, finalMax));
                    popup.style.height = `${safeH}px`;
                    if (cssVar) document.documentElement.style.setProperty(cssVar, `${safeH}px`);
                    if (onResize) onResize(safeH);
                }
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

            if (deviceStorageKey) {
                localStorage.setItem(deviceStorageKey, popup.style.height);
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
