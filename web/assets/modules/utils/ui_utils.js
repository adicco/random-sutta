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
                // We lock the raw value to --safe-bottom for precise positioning.
                // On desktop/standard android, this will be 0.
                document.documentElement.style.setProperty('--safe-bottom', `${safeAreaPx}px`);
                document.body.removeChild(div);
                
                console.log(`[UIUtils] Safe area locked: hardware=${safeAreaPx}px`);
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
            requestAnimationFrame(() => {
                const viewport = window.visualViewport;
                // Calculate actual offset from bottom
                let offset = window.innerHeight - viewport.height;
                
                // [iOS Fix] If offset is small, it's likely browser UI or rounding error, not keyboard
                if (offset < 40) offset = 0;

                const fixedBottomElements = [
                    document.getElementById("global-toolbar"),
                    document.getElementById("magic-toolbar-trigger"),
                    document.getElementById("magic-tts-trigger"),
                    document.querySelector(".popup-container:not(.hidden)"),
                    document.getElementById("lookup-popup")
                ];

                fixedBottomElements.forEach(el => {
                    if (el) {
                        // Apply precise offset or clear it to let CSS take over
                        if (offset > 0) {
                            el.style.bottom = `${offset}px`;
                        } else {
                            el.style.bottom = "0px";
                            // Use empty string after a tick to let CSS defaults fully restore if needed
                            setTimeout(() => { if (offset === 0) el.style.bottom = ""; }, 100);
                        }
                    }
                });

                if (offset > 0) {
                    window.scrollTo(viewport.offsetLeft, viewport.offsetTop);
                }
            });
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
        
        // Extra guard: Reset on focusout to catch cases where resize event is missed
        document.addEventListener('focusout', () => {
            setTimeout(handleViewportChange, 300);
        });
    }
};
