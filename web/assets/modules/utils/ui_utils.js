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
    }
};
