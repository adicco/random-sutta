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
        if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
        
        // Brute force sync: Scroll the OUTER window to 0,0
        // In Fixed Shell, the outer window should NEVER have a scroll.
        window.scrollTo(0, 0);
        
        // Force a layout reflow
        const doc = document.documentElement;
        const prevH = doc.style.height;
        doc.style.height = '100.1%';
        requestAnimationFrame(() => {
            doc.style.height = prevH || '100dvh';
            window.scrollTo(0, 0);
        });
    },

    /**
     * Sets up ongoing listeners to keep the viewport stable.
     */
    initViewportLock() {
        if (!window.visualViewport) return;

        let pollingTimer = null;
        const pollCount = 15; // Poll for 1.5 seconds

        const updateElements = (offset) => {
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
                        // Clear inline style to let CSS take over (Safe Area)
                        el.style.bottom = "";
                    }
                }
            });
        };

        const handleViewportChange = () => {
            const viewport = window.visualViewport;
            const safeArea = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0;
            
            // Calculate keyboard offset
            let offset = window.innerHeight - viewport.height;
            
            // Substract safe area when keyboard is active to prevent "too high"
            if (offset > 45) {
                offset = Math.max(0, offset - safeArea);
            } else {
                offset = 0;
            }

            updateElements(offset);

            // Sync visual viewport scroll
            if (offset > 0 || viewport.offsetTop > 0) {
                window.scrollTo(viewport.offsetLeft, viewport.offsetTop);
            }
        };

        const startAggressivePolling = () => {
            if (pollingTimer) clearInterval(pollingTimer);
            let count = 0;
            pollingTimer = setInterval(() => {
                handleViewportChange();
                // On dismissal, force window scroll to 0
                if (window.visualViewport.height >= window.innerHeight - 10) {
                    window.scrollTo(0, 0);
                }
                if (++count >= pollCount) clearInterval(pollingTimer);
            }, 100);
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
        
        // Detect keyboard dismissal via focusout
        document.addEventListener('focusout', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                this.stabilizeViewport();
                startAggressivePolling();
            }
        });

        // Also poll on focusin to catch the "Done" bar appearance
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                startAggressivePolling();
            }
        });
    }
};
