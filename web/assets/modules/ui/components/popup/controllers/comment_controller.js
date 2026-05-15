// Path: web/assets/modules/ui/components/popup/controllers/comment_controller.js
import { PopupState } from '../state/popup_state.js';
import { PopupScanner } from '../utils/popup_scanner.js';
import { CommentUI } from '../ui/comment_ui.js';
import { QuicklookUI } from '../ui/quicklook_ui.js';
import { Scroller } from 'ui/common/scroller.js';
import { ResizeHandler } from 'ui/common/resize_handler.js';

import { ZIndexManager } from 'ui/common/z_index_manager.js';

export const CommentController = {
    init() {
        CommentUI.init({
            onClose: () => this.close(),
            onNavigate: (dir) => this.navigate(dir),
            onToggleAuto: () => this.toggleAuto(),
            onLinkClick: (href) => {
                window.dispatchEvent(new CustomEvent('popup:request-link', { detail: { href } }));
            }
        });

        // Initialize Auto-Switch button state
        CommentUI.updateAutoButton(PopupState.isAutoSwitch);

        // Attach Resizer
        const commentPopup = document.getElementById("comment-popup");
        const resizeHandle = document.getElementById("comment-resize-handle");
        if (commentPopup && resizeHandle) {
            ResizeHandler.attach(commentPopup, resizeHandle, {
                storageKey: 'bottom_popup_height',
                cssVar: '--popup-comment-height',
                maxHeightVh: 80,
                maxHeightPx: () => {
                    // [DYNAMIC LIMIT] If Quicklook is open, leave at least 120px for it
                    if (QuicklookUI.isVisible()) {
                        const topLimit = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--popup-quicklook-top')) || 70;
                        return window.innerHeight - topLimit - 120;
                    }
                    return window.innerHeight * 0.8;
                }
            });
        }
    },

    toggleAuto() {
        const newState = !PopupState.isAutoSwitch;
        PopupState.setAutoSwitch(newState);
        CommentUI.updateAutoButton(newState);
        if (newState) {
            this.handleAutoSwitch();
        }
    },

    handleAutoSwitch() {
        if (!PopupState.isAutoSwitch || !CommentUI.isVisible()) return;

        const comments = PopupState.getComments();
        if (comments.length === 0) return;

        const container = document.getElementById("sutta-container");
        if (!container) return;

        const markers = Array.from(container.querySelectorAll(".comment-marker"));
        if (markers.length === 0) return;

        const viewportHeight = window.innerHeight;
        const thresholdPercent = PopupState.autoSwitchThreshold / 100;
        const thresholdBottom = viewportHeight * (1 - thresholdPercent); // e.g., 40% from bottom means top 60% of screen

        let bestIndex = -1;
        let minTopDistance = Infinity;

        markers.forEach((marker, index) => {
            const rect = marker.getBoundingClientRect();
            
            // [FIXED] Must be visible (rect.top >= 0) to avoid switching before it appears when scrolling up.
            // Condition: Must be above the user-defined bottom threshold.
            if (rect.top >= 0 && rect.top < thresholdBottom) {
                // Closest to the top edge (rect.top is distance from top of viewport)
                if (rect.top < minTopDistance) {
                    minTopDistance = rect.top;
                    bestIndex = index;
                }
            }
        });

        if (bestIndex !== -1 && bestIndex !== PopupState.activeIndex) {
            this.activate(bestIndex);
        }
    },

    scanComments() {
        const list = PopupScanner.scan("sutta-container");
        PopupState.setComments(list);
    },

    openByText(text) {
        const comments = PopupState.getComments();
        if (comments.length === 0) this.scanComments();
        
        const index = PopupState.getComments().findIndex(c => c.text === text);
        if (index !== -1) {
            this.openByIndex(index);
        }
    },

    openByIndex(index) {
        const comments = PopupState.getComments();
        if (comments.length === 0) {
            this.scanComments();
        }
        
        const currentComments = PopupState.getComments();
        if (index >= 0 && index < currentComments.length) {
            this.activate(index);
            
            // [FIXED] Highlight segment when marker is clicked directly
            const item = currentComments[index];
            if (item && item.id) {
                // No need to jump (user is already there), just highlight
                Scroller.highlightElement(item.id);
            }

            QuicklookUI.hide();
        }
    },

    activate(index) {
        PopupState.setCommentActive(index);
        
        const comments = PopupState.getComments();
        const total = comments.length;
        
        if (index >= 0 && index < total) {
            const item = comments[index];
            const context = PopupScanner.getContextText(comments, index);
            CommentUI.render(item.text, index, total, context);

            // [FIXED] Ensure segment highlight matches the currently active comment
            if (item && item.id) {
                Scroller.highlightElement(item.id);
            }
        }
    },

    navigate(dir) {
        // [NEW] Nested Comment Navigation (Inside Quicklook)
        if (QuicklookUI.isVisible() && PopupState.nestedActiveIndex !== -1) {
            const qlContent = QuicklookUI.elements.content;
            const markers = Array.from(qlContent.querySelectorAll(".comment-marker"));
            
            const nextIdx = PopupState.nestedActiveIndex + dir;
            if (nextIdx >= 0 && nextIdx < markers.length) {
                const marker = markers[nextIdx];
                PopupState.nestedActiveIndex = nextIdx;
                PopupState.nestedActiveText = marker.dataset.comment;
                
                CommentUI.render(marker.dataset.comment, nextIdx, markers.length, "Note from Preview");
                
                // Scroll Quicklook to the marker
                marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        let currentIdx = PopupState.activeIndex;
        const comments = PopupState.getComments();
        
        const nextIdx = currentIdx + dir;
        if (nextIdx >= 0 && nextIdx < comments.length) {
            this.activate(nextIdx);
            
            // [FIXED] Instant Jump & Highlight Sync for Navigation
            const item = comments[nextIdx];
            if (item && item.id) {
                Scroller.jumpTo(item.id);
                Scroller.highlightElement(item.id);
            }
            
            QuicklookUI.hide();
        }
    },

    close() {
        // [NEW] Closing Nested Comment
        if (QuicklookUI.isVisible() && PopupState.nestedActiveIndex !== -1) {
            PopupState.nestedActiveIndex = -1;
            PopupState.nestedActiveText = null;
            
            // If there was a main comment active, restore it
            if (PopupState.activeIndex !== -1) {
                this.activate(PopupState.activeIndex);
                const qlEl = document.getElementById("quicklook-popup");
                if (qlEl) ZIndexManager.bringToFront(qlEl);
            } else {
                CommentUI.hide();
                const qlEl = document.getElementById("quicklook-popup");
                if (qlEl) ZIndexManager.bringToFront(qlEl);
            }
            return;
        }

        CommentUI.hide();
        QuicklookUI.hide(); // Close child popup (Quicklook)
        PopupState.clearActive();
        Scroller.highlightElement(null);
    }
};