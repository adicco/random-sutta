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

        let resetTimer1 = null;
        let resetTimer2 = null;

        const handleViewportChange = () => {
            if (resetTimer1) clearTimeout(resetTimer1);
            if (resetTimer2) clearTimeout(resetTimer2);

            requestAnimationFrame(() => {
                const viewport = window.visualViewport;
                const safeArea = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0;
                const isIPad = /iPad/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                
                // Calculate raw keyboard offset
                let offset = window.innerHeight - viewport.height;
                
                // [iOS/iPadOS Fix] Keyboard detection threshold. 
                // iPad accessory bars can be shorter, but 45px is a safe minimum.
                if (offset < 45) {
                    offset = 0;
                } else {
                    // [UX Fix] Keyboard covers Home Indicator area, so subtract safeArea.
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
                            // Pass 1: Immediate snap to bottom (might still have accessory bar gap)
                            el.style.bottom = "0px";
                            
                            // Pass 2: Catch standard dismissal (500ms)
                            resetTimer1 = setTimeout(() => {
                                el.style.bottom = "0px";
                            }, 500);

                            // Pass 3: Final cleanup for very slow OS animations or iPad glitches (1000ms)
                            resetTimer2 = setTimeout(() => {
                                el.style.bottom = ""; // Restore PURE CSS defaults
                            }, 1000);
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
