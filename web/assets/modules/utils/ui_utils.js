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
        
        // Brute force sync: many times to fight iOS animation
        const performReset = () => {
            window.scrollTo(0, 0);
            if (document.body) document.body.scrollTop = 0;
            if (document.documentElement) document.documentElement.scrollTop = 0;
        };

        performReset();
        
        // Force a layout reflow by toggling a property
        const doc = document.documentElement;
        const prevH = doc.style.height;
        doc.style.height = '100.1%';
        
        // Series of resets to catch different phases of keyboard dismissal
        [50, 150, 300, 500].forEach(delay => {
            setTimeout(() => {
                if (delay === 300) doc.style.height = prevH || '100dvh';
                performReset();
                
                // Final check for fixed elements
                if (delay === 500) {
                    this._forceFixedElementsReflow();
                }
            }, delay);
        });
    },

    /**
     * Toggles position of fixed elements to force iOS to re-anchor them correctly.
     */
    _forceFixedElementsReflow() {
        const fixedElements = [
            document.getElementById("global-toolbar"),
            document.getElementById("magic-toolbar-trigger"),
            document.getElementById("magic-tts-trigger"),
            document.querySelector(".popup-container:not(.hidden)"),
            document.getElementById("lookup-popup")
        ];

        fixedElements.forEach(el => {
            if (el) {
                const originalPos = getComputedStyle(el).position;
                if (originalPos === 'fixed') {
                    el.style.position = 'absolute';
                    // Force layout
                    el.offsetHeight;
                    requestAnimationFrame(() => {
                        el.style.position = 'fixed';
                    });
                }
            }
        });
    },

    /**
     * Sets up ongoing listeners to keep the viewport stable.
     */
    initViewportLock() {
        if (!window.visualViewport) return;

        let pollingTimer = null;
        const pollCount = 30; // Poll for 3 seconds

        const updateElements = (offset) => {
            // Apply offset via CSS variable for better performance and consistency
            document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);

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
                        el.classList.add('keyboard-pushed');
                    } else {
                        el.style.bottom = "";
                        el.classList.remove('keyboard-pushed');
                    }
                }
            });
            
            if (offset > 0) {
                document.body.classList.add('keyboard-visible');
            } else {
                document.body.classList.remove('keyboard-visible');
            }
        };

        const handleViewportChange = () => {
            const viewport = window.visualViewport;
            const safeArea = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0;
            
            // Calculate keyboard offset
            let offset = Math.round(window.innerHeight - viewport.height);
            
            // Substract safe area when keyboard is active
            if (offset > 45) {
                offset = Math.max(0, offset - safeArea);
            } else {
                offset = 0;
            }

            updateElements(offset);

            // Sync visual viewport scroll
            if (offset > 0 || viewport.offsetTop > 0) {
                window.scrollTo(viewport.offsetLeft, viewport.offsetTop);
            } else if (window.scrollY !== 0) {
                window.scrollTo(0, 0);
            }
        };

        const startAggressivePolling = () => {
            if (pollingTimer) clearInterval(pollingTimer);
            let count = 0;
            pollingTimer = setInterval(() => {
                handleViewportChange();
                
                // If keyboard is likely closed, force scroll reset
                const isDismissed = window.visualViewport.height >= window.innerHeight - 10;
                if (isDismissed) {
                    window.scrollTo(0, 0);
                    document.body.scrollTop = 0;
                    document.documentElement.scrollTop = 0;
                }
                
                if (++count >= pollCount) {
                    clearInterval(pollingTimer);
                    this.stabilizeViewport();
                }
            }, 100);
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
        
        // Detect keyboard dismissal via focusout
        document.addEventListener('focusout', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                startAggressivePolling();
            }
        });

        // Also poll on focusin to catch appearance
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                startAggressivePolling();
            }
        });
    }
};
