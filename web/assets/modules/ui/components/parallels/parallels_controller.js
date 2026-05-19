// Path: web/assets/modules/ui/components/parallels/parallels_controller.js
import { ParallelsData } from './parallels_data.js';
import { ResizeHandler } from 'ui/common/resize_handler.js';
import { ParallelsScroll } from './parallels_scroll.js';
import { QuicklookController } from 'ui/components/popup/controllers/quicklook_controller.js';
import { ZIndexManager } from 'ui/common/z_index_manager.js';
import { PopupState } from 'ui/components/popup/state/popup_state.js';

let currentEls = null;

export const ParallelsController = {
    open() {
        if (!currentEls) return;
        currentEls.popup.classList.remove("hidden");
        currentEls.fab.classList.add("active");
        document.body.classList.add("parallels-open");
        ZIndexManager.bringToFront(currentEls.popup);
        PopupState.parallelsOpen = true;
        PopupState.saveSnapshot();
    },

    close() {
        if (!currentEls) return;
        currentEls.popup.classList.add("hidden");
        currentEls.fab.classList.remove("active");
        document.body.classList.remove("parallels-open");
        PopupState.parallelsOpen = false;
        PopupState.saveSnapshot();
    },

    toggle() {
        if (!currentEls) return;
        const isHidden = currentEls.popup.classList.contains("hidden");
        if (isHidden) {
            this.open();
        } else {
            this.close();
        }
    }
};

export function setupParallelsPanel() {
    const els = {
        wrapper: document.getElementById("parallels-panel"),
        fab: document.getElementById("parallels-fab"),
        popup: document.getElementById("parallels-popup"),
        list: document.getElementById("parallels-list"),
        closeBtn: document.getElementById("close-parallels"),
        resizeHandle: document.getElementById("parallels-resize-handle")
    };

    if (!els.wrapper || !els.fab || !els.popup || !els.list) {
        return { generate: () => {} };
    }

    currentEls = els;

    // [Z-INDEX] Register popup
    ZIndexManager.register(els.popup);

    // --- Resize Logic ---
    if (els.resizeHandle) {
        ResizeHandler.attach(els.popup, els.resizeHandle, {
            storageKey: 'parallels_popup_height',
            cssVar: '--popup-parallels-height',
            maxHeightVh: 80
        });
    }

    // --- Event Handlers ---
    els.fab.onclick = (e) => {
        ParallelsController.toggle();
        e.stopPropagation();
    };

    if (els.closeBtn) {
        els.closeBtn.onclick = (e) => {
            e.stopPropagation();
            ParallelsController.close();
        };
    }

    // Handle link clicks inside parallels list
    els.list.addEventListener("click", (e) => {
        const link = e.target.closest(".parallels-link");
        if (link) {
            e.preventDefault();
            e.stopPropagation();
            const target = link.dataset.target;
            if (target) {
                QuicklookController.handleLinkRequest(target);
            }
        }
    });

    // --- Scroll Isolation ---
    const popupBody = els.popup.querySelector(".popup-body");
    ParallelsScroll.enableIsolation(els.popup, () => popupBody);

    // Click outside to close (optional, depending on preference)
    document.addEventListener("click", (e) => {
        if (currentEls && !currentEls.popup.classList.contains("hidden") && 
            !currentEls.popup.contains(e.target) && 
            !currentEls.fab.contains(e.target)) {
            ParallelsController.close();
        }
    });

    async function generate(suttaId) {
        // Reset State
        els.list.innerHTML = "";
        
        // Hide FAB initially while loading
        els.fab.classList.add("hidden");
        
        // Load Parallels
        const hasData = await ParallelsData.load(suttaId, els.list);
        
        if (hasData) {
            // Show panel wrapper and fab
            els.wrapper.classList.remove("hidden");
            els.fab.classList.remove("hidden");
        } else {
            // Keep fab hidden if no data
            els.wrapper.classList.remove("hidden");
        }
    }

    return { generate };
}