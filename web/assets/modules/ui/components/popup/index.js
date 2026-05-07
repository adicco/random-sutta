// Path: web/assets/modules/ui/components/popup/index.js
import { PopupOrchestrator } from './popup_orchestrator.js';

export const PopupAPI = {
    scan: () => PopupOrchestrator.scanComments(),
    hideAll: () => PopupOrchestrator.closeAll(),
    restore: () => PopupOrchestrator.restoreState(),
    init: () => PopupOrchestrator.init()
};

// Legacy support (matches existing usage in app.js)
export function initPopupSystem() {
    PopupOrchestrator.init();
    return PopupAPI;
}
