// Path: web/assets/modules/ui/components/popup/controllers/comment_controller.js
import { PopupState } from '../state/popup_state.js';
import { PopupScanner } from '../utils/popup_scanner.js';
import { CommentUI } from '../ui/comment_ui.js';
import { QuicklookUI } from '../ui/quicklook_ui.js';
import { Scroller } from 'ui/common/scroller.js';

export const CommentController = {
    init() {
        CommentUI.init({
            onClose: () => this.close(),
            onNavigate: (dir) => this.navigate(dir),
            onLinkClick: (href) => {
                window.dispatchEvent(new CustomEvent('popup:request-link', { detail: { href } }));
            }
        });
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

            // [STACKING] Bring to Front
            const commentEl = document.getElementById("comment-popup");
            const lookupEl = document.getElementById("lookup-popup");
            if (commentEl) commentEl.classList.add("is-top-layer");
            if (lookupEl) lookupEl.classList.remove("is-top-layer");
        }
    },

    navigate(dir) {
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
        CommentUI.hide();
        QuicklookUI.hide(); // Close child popup (Quicklook)
        PopupState.clearActive();
        Scroller.highlightElement(null);

        // [STACKING] Yield 'top-layer' to Lookup if it's still open
        const commentEl = document.getElementById("comment-popup");
        if (commentEl) commentEl.classList.remove("is-top-layer");

        const lookupEl = document.getElementById("lookup-popup");
        // Check visibility via class hidden logic
        if (lookupEl && !lookupEl.classList.contains("hidden")) {
            lookupEl.classList.add("is-top-layer");
        }
    }
};