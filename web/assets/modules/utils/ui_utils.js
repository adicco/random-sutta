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

        let resetTimer = null;

        const handleViewportChange = () => {
            if (resetTimer) clearTimeout(resetTimer);

            requestAnimationFrame(() => {
                const viewport = window.visualViewport;
                const safeArea = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0;
                
                // Calculate raw keyboard offset
                let offset = window.innerHeight - viewport.height;
                
                // [iOS Fix] If offset is small (e.g. < 45px), it's likely just the Done/Accessory bar 
                // or dynamic UI, but we want a clean reset to 0 if it's below a threshold.
                if (offset < 45) {
                    offset = 0;
                } else {
                    // [UX Fix] Since the keyboard covers the physical safe area (Home Indicator), 
                    // we subtract safeArea from the push offset to prevent the UI from being "too high".
                    offset = Math.max(0, offset - safeArea);
                }

                const fixedBottomElements = [
                    document.getElementById("global-toolbar"),
                    document.getElementById("magic-toolbar-trigger"),
                    document.getElementById("magic-tts-trigger"),
                    document.querySelector(".popup-container:not(.hidden)"),
                    document.getElementById("lookup-popup")
                ];

                fixedBottomElements.forEach(el => {
                    if (el) {
                        if (offset > 0) {
                            el.style.bottom = `${offset}px`;
                        } else {
                            // Immediate snap to bottom
                            el.style.bottom = "0px";
                            
                            // [CRITICAL] Secondary reset to catch the "Accessory Bar" lag (V ^ Done bar)
                            // This bar on iOS disappears ~300ms after the main keyboard.
                            resetTimer = setTimeout(() => {
                                el.style.bottom = ""; // Restore CSS defaults (Safe Area)
                            }, 500);
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
