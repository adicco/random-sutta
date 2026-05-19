// Path: web/assets/modules/ui/components/popup/index.js
import { PopupOrchestrator } from './popup_orchestrator.js';

export const PopupAPI = {
    scan: () => PopupOrchestrator.scanComments(),
    hideAll: (skipSnapshot = false) => {
        // [MODIFIED] Dispatch event instead of direct call to ensure 
        // decoupled components (like LookupManager) also respond.
        window.dispatchEvent(new CustomEvent('popup:close-all', { 
            detail: { skipSnapshot } 
        }));
    },
    restore: () => PopupOrchestrator.restoreState(),
    init: () => PopupOrchestrator.init()
};

// Legacy support (matches existing usage in app.js)
export function initPopupSystem() {
    PopupOrchestrator.init();
    return PopupAPI;
}
