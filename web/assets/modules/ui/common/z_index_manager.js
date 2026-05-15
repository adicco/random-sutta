// Path: web/assets/modules/ui/common/z_index_manager.js

// Start higher than CSS defaults (usually around 1000-1050)
// And also higher than legacy .is-top-layer (2000)
let currentMaxZIndex = 2100;

export const ZIndexManager = {
    /**
     * Brings the specified element to the front by incrementing global z-index
     * and assigning it to the element.
     * @param {HTMLElement} element 
     */
    bringToFront(element) {
        if (!element) return;
        
        // Check if it's already the highest to avoid unnecessary increments
        const currentZ = parseInt(element.style.zIndex || 0);
        if (currentZ === currentMaxZIndex) return;

        currentMaxZIndex++;
        element.style.zIndex = currentMaxZIndex;
    },

    /**
     * Registers an element to automatically come to front on interaction.
     * @param {HTMLElement} element 
     */
    register(element) {
        if (!element) return;

        const comeToFront = () => this.bringToFront(element);

        // Bring to front on touch or click
        element.addEventListener('mousedown', comeToFront, { passive: true });
        element.addEventListener('touchstart', comeToFront, { passive: true });
    }
};