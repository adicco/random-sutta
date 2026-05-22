// Path: web/assets/modules/utils/ui_utils.js

/**
 * UI Utilities for handling platform-specific constraints and visual stabilization.
 */
export const UIUtils = {
    /**
     * Detects the device's safe area inset bottom (hardware-level) and "locks" it 
     * into a CSS variable to prevent shifting when the browser's dynamic UI (like URL bar) toggles.
     */
    lockSafeAreaBottom() {
        if (this._isLocked) return;
        
        const setLock = () => {
            if (this._isLocked) return;
            this._isLocked = true;

            const div = document.createElement('div');
            div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
            div.style.visibility = 'hidden';
            div.style.position = 'fixed';
            div.style.bottom = '0';
            div.style.left = '0';
            div.style.pointerEvents = 'none';
            document.body.appendChild(div);
            
            requestAnimationFrame(() => {
                const computed = window.getComputedStyle(div).paddingBottom;
                const safeAreaPx = parseInt(computed) || 0;
                
                // Hardware safe area (e.g., 34px on iPhone X+)
                // We add a small base padding (15px) for aesthetics.
                // Default minimum is 20px.
                const finalPadding = Math.max(20, safeAreaPx + 15);
                
                document.documentElement.style.setProperty('--safe-bottom', `${finalPadding}px`);
                document.body.removeChild(div);
                
                console.log(`[UIUtils] Safe area locked: hardware=${safeAreaPx}px, final=${finalPadding}px`);
            });
        };

        if (document.readyState === 'complete') {
            setLock();
        } else {
            window.addEventListener('load', setLock, { once: true });
            // Also try on DOMContentLoaded just in case load is delayed
            document.addEventListener('DOMContentLoaded', setLock, { once: true });
        }
    },

    /**
     * Fix for iOS Safari where the visual viewport doesn't correctly sync with the layout viewport
     * after the keyboard is hidden, causing fixed elements to shift or move during scroll.
     */
    stabilizeViewport() {
        // Redundant in Fixed Shell architecture, kept as a no-op if needed for legacy calls
    },

    /**
     * Sets up ongoing listeners to keep the viewport stable.
     */
    initViewportLock() {
        if (!window.visualViewport) return;

        const handleViewportChange = () => {
            const viewport = window.visualViewport;
            const offset = window.innerHeight - viewport.height;
            
            // Adjust bottom-fixed elements
            const fixedBottomElements = [
                document.getElementById("global-toolbar"),
                document.getElementById("magic-toolbar-trigger"),
                document.getElementById("magic-tts-trigger"),
                document.querySelector(".popup-container:not(.hidden)"),
                document.getElementById("lookup-popup:not(.hidden)")
            ];

            fixedBottomElements.forEach(el => {
                if (el) {
                    // Push up by the amount the keyboard covers
                    el.style.bottom = `${offset}px`;
                }
            });

            // Also ensure we are scrolled to the right visual spot
            if (offset > 0) {
                window.scrollTo(viewport.offsetLeft, viewport.offsetTop);
            }
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
};
