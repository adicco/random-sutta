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
        // Run once on load
        const setLock = () => {
            const div = document.createElement('div');
            // env() with a fallback to ensure we can read it
            div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
            div.style.visibility = 'hidden';
            div.style.position = 'fixed';
            div.style.pointerEvents = 'none';
            document.body.appendChild(div);
            
            // Allow a small tick for the browser to resolve the env() value
            requestAnimationFrame(() => {
                const computed = window.getComputedStyle(div).paddingBottom;
                const safeAreaPx = parseInt(computed) || 0;
                
                // Hardware safe area (e.g., 34px on iPhone X+)
                // We add a small base padding (15px) for aesthetics.
                const finalPadding = Math.max(20, safeAreaPx + 15);
                
                document.documentElement.style.setProperty('--safe-bottom', `${finalPadding}px`);
                document.body.removeChild(div);
                
                // console.log(`[UIUtils] Safe area locked: hardware=${safeAreaPx}px, final=${finalPadding}px`);
            });
        };

        if (document.readyState === 'complete') {
            setLock();
        } else {
            window.addEventListener('load', setLock);
        }
    }
};
