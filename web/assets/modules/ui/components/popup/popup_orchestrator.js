// Path: web/assets/modules/ui/components/popup/popup_orchestrator.js
import { CommentController } from './controllers/comment_controller.js';
import { QuicklookController } from './controllers/quicklook_controller.js';
import { RestorationController } from './controllers/restoration_controller.js';
import { PopupState } from './state/popup_state.js';
import { CommentUI } from './ui/comment_ui.js';
import { QuicklookUI } from './ui/quicklook_ui.js';
import { AppConfig } from 'core/app_config.js';
import { Scroller } from 'ui/common/scroller.js'; // [NEW] Import Scroller
import { ParallelsController } from 'ui/components/parallels/parallels_controller.js'; // [NEW] Import Parallels

export const PopupOrchestrator = {
    isInitialized: false,

    init() {
        if (this.isInitialized) return;
        
        this._applyLayoutConfig();
        // 1. Init Controllers
        CommentController.init();
        QuicklookController.init();
        // 2. Listen for Custom Events (Bus)
        window.addEventListener('popup:close-all', (e) => this.closeAll(e.detail?.skipSnapshot, e.detail));
        window.addEventListener('popup:request-link', (e) => {
            if (e.detail && e.detail.href) {
                QuicklookController.handleLinkRequest(e.detail.href);
            }
        });
        // 3. Bind Global Interactions
        this._bindGlobalEvents();

        this.isInitialized = true;
    },

    restoreState() {
        RestorationController.restore();
    },

    scanComments() {
        CommentController.scanComments();
    },

    closeAll(skipSnapshot = false, options = {}) {
        CommentUI.hide();
        QuicklookUI.hide();
        PopupState.loadingUid = null;
        PopupState.clearActive();
        
        // [NEW] Also close Parallels, unless explicitly skipped
        if (options.skipParallels !== true) {
            ParallelsController.close(skipSnapshot);
        }

        // [UX IMPROVEMENT] Xóa highlight khi đóng popup
        // Giúp giao diện sạch sẽ, người dùng không bị rối mắt bởi vệt sáng cũ
        Scroller.highlightElement(null);
    },

    _bindGlobalEvents() {
        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("click", (e) => {
                const markerEl = e.target.closest(".comment-marker");
                if (markerEl) {
                    e.stopPropagation();
                    
                    // [FIXED] Identify exact index of clicked marker to avoid "jumping" on duplicate texts
                    const markers = Array.from(container.querySelectorAll(".comment-marker"));
                    const index = markers.indexOf(markerEl);
                    
                    if (index !== -1) {
                        CommentController.openByIndex(index);
                    } else {
                        // Fallback to text if index search fails
                        CommentController.openByText(markerEl.dataset.comment);
                    }
                } else {
                    // Click Outside Logic
                    if (QuicklookUI.isVisible() && !QuicklookUI.elements.popup.contains(e.target)) {
                        QuicklookUI.hide();
                        // Revert logic
                        if (PopupState.activeIndex !== -1) {
                            PopupState.activeType = 'comment';
                            PopupState.activeUrl = null;
                        } else {
                            this.closeAll(false, { skipParallels: true });
                        }
                    }
                    // [MODIFIED] Comment Popup now ONLY closes via the Close Button (X).
                    // The "Click Outside" logic for CommentUI has been removed per user request for better stability.
                }
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (QuicklookUI.isVisible()) {
                    QuicklookUI.hide();
                    // Revert logic
                    if (PopupState.activeIndex !== -1) {
                        PopupState.activeType = 'comment';
                        PopupState.activeUrl = null;
                    } else {
                        this.closeAll(false, { skipParallels: true });
                    }
                }
                else if (CommentUI.isVisible()) this.closeAll();
            }
            // Check if Comment is the Top Layer
            const commentEl = document.getElementById("comment-popup");
            const isTopLayer = commentEl && commentEl.classList.contains("is-top-layer");
            
            if (CommentUI.isVisible() && !QuicklookUI.isVisible() && isTopLayer) {
                if (e.key === "ArrowLeft") CommentController.navigate(-1);
                if (e.key === "ArrowRight") CommentController.navigate(1);
            }
        });
    },

    _applyLayoutConfig() {
        const layout = AppConfig.POPUP_LAYOUT;
        if (layout) {
            const root = document.documentElement;
            root.style.setProperty('--popup-comment-height', `${layout.COMMENT_HEIGHT_VH}vh`);
            root.style.setProperty('--popup-quicklook-top', `${layout.QUICKLOOK_TOP_OFFSET_PX}px`);
        }
    }
};