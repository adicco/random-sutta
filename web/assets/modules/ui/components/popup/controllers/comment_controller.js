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
        
        // Reset cache to force fresh render when switching modes
        CommentUI.lastAutoJson = null;

        if (newState) {
            this.handleAutoSwitch();
        } else {
            // [NEW] Restore manual view when Auto mode is disabled
            if (PopupState.activeIndex !== -1) {
                this.activate(PopupState.activeIndex);
            } else {
                CommentUI.hide();
            }
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

        const inRangeItems = [];
        const inRangeIndices = [];

        markers.forEach((marker, index) => {
            const rect = marker.getBoundingClientRect();
            
            // Check if marker is within the viewport vertically and horizontally
            if (rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth) {
                // Get the center point of the marker
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                
                // Determine the topmost element at this point
                const topmostElement = document.elementFromPoint(x, y);
                
                // If the topmost element is the marker or a descendant (or if marker contains it), it's visible
                if (topmostElement && (topmostElement === marker || marker.contains(topmostElement))) {
                    const commentText = marker.dataset.comment;
                    if (commentText) {
                        inRangeItems.push({ text: commentText, index: index });
                        inRangeIndices.push(index);
                    }
                }
            }
        });

        if (inRangeItems.length > 0) {
            // Pass the array of items (text + index) for better rendering and anchoring
            CommentUI.renderAuto(inRangeItems);
            
            // Highlight the first one in range if not already active
            if (inRangeIndices.length > 0 && inRangeIndices[0] !== PopupState.activeIndex) {
                PopupState.setCommentActive(inRangeIndices[0]);
                const item = comments[inRangeIndices[0]];
                if (item && item.id) {
                    Scroller.highlightElement(item.id);
                }
            }
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

    openByIndex(index, markerEl = null) {
        const comments = PopupState.getComments();
        if (comments.length === 0) {
            this.scanComments();
        }
        
        const currentComments = PopupState.getComments();
        if (index >= 0 && index < currentComments.length) {
            this.activate(index);
            
            // [FIXED] Jump & Highlight segment when marker is clicked directly
            // Use markerEl for precise scrolling if available, otherwise find it in the container
            const item = currentComments[index];
            
            if (!markerEl) {
                const container = document.getElementById("sutta-container");
                const markers = container ? Array.from(container.querySelectorAll(".comment-marker")) : [];
                markerEl = markers[index];
            }

            // [NEW] Balanced Smart Jump
            this._smartJump(markerEl, item?.id);
            
            if (item && item.id) {
                Scroller.highlightElement(item.id);
            }

            QuicklookUI.hide();
        }
    },

    activate(index, isRestoring = false) {
        PopupState.setCommentActive(index);
        
        const comments = PopupState.getComments();
        const total = comments.length;
        
        if (index >= 0 && index < total) {
            const item = comments[index];

            if (PopupState.isAutoSwitch) {
                // [FIXED] If Auto mode is on, ensure we use the Auto UI even when clicking a marker
                if (!CommentUI.isVisible()) {
                    CommentUI.renderAuto([]); // Show popup to allow handleAutoSwitch to run
                }
                this.handleAutoSwitch();
            } else {
                const context = PopupScanner.getContextText(comments, index);
                CommentUI.render(item.text, index, total, context, isRestoring);
            }

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
            const qBody = QuicklookUI.elements.popupBody;
            const markers = Array.from(qlContent.querySelectorAll(".comment-marker"));
            
            const nextIdx = PopupState.nestedActiveIndex + dir;
            if (nextIdx >= 0 && nextIdx < markers.length) {
                const marker = markers[nextIdx];
                const segment = marker.closest('.segment');
                
                PopupState.nestedActiveIndex = nextIdx;
                PopupState.nestedActiveText = marker.dataset.comment;
                
                CommentUI.render(marker.dataset.comment, nextIdx, markers.length, "Note from Preview");
                
                // [NEW] Scroll and Highlight inside Quicklook
                marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (segment && segment.id && qBody) {
                    Scroller.highlightElement(segment.id, false, null, qBody);
                }
            }
            return;
        }

        let currentIdx = PopupState.activeIndex;
        const comments = PopupState.getComments();
        
        const nextIdx = currentIdx + dir;
        if (nextIdx >= 0 && nextIdx < comments.length) {
            this.navigateToIndex(nextIdx);
            QuicklookUI.hide();
        }
    },

    // [NEW] Helper for standardized navigation
    navigateToIndex(index) {
        const comments = PopupState.getComments();
        if (index < 0 || index >= comments.length) return;

        this.activate(index);
        
        const item = comments[index];
        const container = document.getElementById("sutta-container");
        const markers = container ? Array.from(container.querySelectorAll(".comment-marker")) : [];
        const markerEl = markers[index];
        
        // [NEW] Balanced Smart Jump
        this._smartJump(markerEl, item?.id);

        if (item && item.id) {
            Scroller.highlightElement(item.id);
        }
    },

    /**
     * [NEW] Balanced Smart Jump Logic
     * Tries to show the start of the segment if it fits along with the marker.
     * Otherwise, prioritizes the marker to ensure it's not obscured.
     */
    _smartJump(markerEl, segmentId) {
        if (!markerEl) {
            if (segmentId) Scroller.jumpTo(segmentId);
            return;
        }

        const segmentEl = document.getElementById(segmentId);
        if (!segmentEl) {
            Scroller.jumpTo(markerEl);
            return;
        }

        const popup = document.getElementById("comment-popup");
        const headerOffset = 45; // Match SCROLL_OFFSET_CTX from Scroller.js
        const viewportHeight = window.innerHeight;
        
        // Estimate visible area height
        const popupHeight = popup ? popup.offsetHeight : (viewportHeight * 0.45);
        const visibleHeight = viewportHeight - popupHeight - headerOffset;

        const markerRect = markerEl.getBoundingClientRect();
        const segmentRect = segmentEl.getBoundingClientRect();
        
        // Relative distance from segment start to marker bottom
        const distanceToMarkerBottom = markerRect.bottom - segmentRect.top;

        // If the span from segment start to marker bottom fits in visible area (with 20px safety margin)
        if (distanceToMarkerBottom < (visibleHeight - 20)) {
            // Context prioritized: Show from the start of the translation segment
            Scroller.jumpTo(segmentId);
        } else {
            // Visibility prioritized: Show specifically the marker
            Scroller.jumpTo(markerEl);
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