// Path: web/assets/modules/ui/components/popup/ui/comment_ui.js
import { SwipeHandler } from 'ui/common/swipe_handler.js';
import { ScrollHandler } from 'ui/common/scroll_handler.js';
import { ZIndexManager } from 'ui/common/z_index_manager.js';

export const CommentUI = {
    elements: {},
    
    init(callbacks) {
        this.elements = {
            popup: document.getElementById("comment-popup"),
            content: document.getElementById("comment-content"),
            headerContext: document.getElementById("comment-context-header"),
            closeBtn: document.getElementById("close-comment"),
            btnPrev: document.getElementById("btn-comment-prev"),
            btnNext: document.getElementById("btn-comment-next"),
            btnAuto: document.getElementById("btn-comment-auto-header"),
            infoLabel: document.getElementById("comment-index-info"),
            popupBody: document.querySelector("#comment-popup .popup-body") 
        };

        if (!this.elements.popup) return;

        // [Z-INDEX] Manage stacking order
        ZIndexManager.register(this.elements.popup);

        // [SCROLL LOCK] Prevent Mouse/Trackpad scroll chaining
        ScrollHandler.preventBackgroundScroll(this.elements.popup, this.elements.popupBody);

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onClose();
        });

        if (this.elements.btnPrev) {
            this.elements.btnPrev.addEventListener("click", () => {
                this.elements.btnPrev.blur();
                callbacks.onNavigate(-1);
            });
        }
        if (this.elements.btnNext) {
            this.elements.btnNext.addEventListener("click", () => {
                this.elements.btnNext.blur();
                callbacks.onNavigate(1);
            });
        }
        if (this.elements.btnAuto) {
            this.elements.btnAuto.addEventListener("click", () => {
                this.elements.btnAuto.blur();
                callbacks.onToggleAuto();
            });
        }

        // Swipe Gestures (Shared Handler)
        SwipeHandler.attach(this.elements.popup, {
            onSwipeLeft: () => callbacks.onNavigate(1),
            onSwipeRight: () => callbacks.onNavigate(-1),
            onVerticalScroll: (e) => {
                // [FIX] Prevent scroll propagation if content is short (not scrollable)
                if (this.elements.popupBody) {
                    const isScrollable = this.elements.popupBody.scrollHeight > this.elements.popupBody.clientHeight;
                    if (!isScrollable && e.cancelable) {
                        e.preventDefault();
                    }
                }
            }
        });

        // [FIX] Isolate Header from Swipe/Scroll inheritance
        if (this.elements.headerContext) {
            const stopPropagation = (e) => e.stopPropagation();
            this.elements.headerContext.addEventListener("touchstart", stopPropagation, { passive: true });
            this.elements.headerContext.addEventListener("touchmove", stopPropagation, { passive: true });
            this.elements.headerContext.addEventListener("touchend", stopPropagation, { passive: true });

            this.elements.headerContext.addEventListener("wheel", (e) => {
                if (this.elements.headerContext.scrollWidth > this.elements.headerContext.clientWidth) {
                    e.preventDefault();
                    this.elements.headerContext.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }

        this.elements.content.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link && link.href) {
                // Delegate link handling to controller
                e.preventDefault();
                e.stopPropagation();
                callbacks.onLinkClick(link.href);
            }
        });
    },

    render(text, index, total, contextText = "", isRestoring = false) {
        if (!this.elements.content) return;
        
        this._renderContent(text);
        
        if (this.elements.headerContext) {
            // [UPDATED] Show context header in manual mode
            this.elements.headerContext.textContent = contextText || "";
            this.elements.headerContext.classList.remove("auto-mode-header");
            this.elements.headerContext.scrollLeft = 0;
        }

        // [Z-INDEX] Bring to front
        ZIndexManager.bringToFront(this.elements.popup);

        this.elements.popup.classList.remove("hidden");
        document.body.classList.add("popup-open"); // [NEW] Add class to body

        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;

        // Show nav in manual mode
        if (this.elements.btnPrev) this.elements.btnPrev.style.display = "";
        if (this.elements.btnNext) this.elements.btnNext.style.display = "";
        if (this.elements.infoLabel) this.elements.infoLabel.style.display = "";

        this._updateNav(index, total);
    },

    // [NEW] Specialized render for Auto-Switch mode
    renderAuto(combinedText) {
        if (!this.elements.content) return;

        this._renderContent(combinedText);

        if (this.elements.headerContext) {
            this.elements.headerContext.textContent = "Comments";
            this.elements.headerContext.classList.add("auto-mode-header");
        }

        // Hide nav in auto mode (no explicit navigation needed)
        if (this.elements.btnPrev) this.elements.btnPrev.style.display = "none";
        if (this.elements.btnNext) this.elements.btnNext.style.display = "none";
        if (this.elements.infoLabel) this.elements.infoLabel.style.display = "none";

        this.elements.popup.classList.remove("hidden");
        document.body.classList.add("popup-open");
    },

    _renderContent(text) {
        if (!text) {
            this.elements.content.innerHTML = "";
            return;
        }

        // 1. Split by " | " first (Auto mode joiner)
        const majorParts = text.split(' | ');
        let finalHtml = "";

        majorParts.forEach(part => {
            let cleanPart = part.trim();
            if (!cleanPart) return;

            // 2. Further split if a part contains internal sequence numbers (e.g., "1. text 2. text")
            // This regex matches a position before a number followed by a dot and space, 
            // but only if it's not at the very beginning.
            const subParts = cleanPart.split(/(?=\d+\.\s)/);
            
            subParts.forEach(sub => {
                let subText = sub.trim();
                if (!subText) return;

                // Style the prefix
                subText = subText.replace(/^(\d+)\.\s/, '<span class="comment-prefix">$1.</span> ');

                // Style internal dividers (|) if any
                subText = subText.replace(/\|/g, '<span class="comment-divider">|</span>');

                finalHtml += `<p class="comment-paragraph">${subText}</p>`;
            });
        });

        this.elements.content.innerHTML = finalHtml;
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
        document.body.classList.remove("popup-open"); // [NEW] Remove class from body
    },

    updateAutoButton(isEnabled) {
        if (this.elements.btnAuto) {
            this.elements.btnAuto.classList.toggle("active", isEnabled);
        }
    },

    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    },

    _updateNav(index, total) {
        if (!this.elements.infoLabel) return;
        this.elements.infoLabel.textContent = `${index + 1} / ${total}`;
        if (this.elements.btnPrev) this.elements.btnPrev.disabled = index <= 0;
        if (this.elements.btnNext) this.elements.btnNext.disabled = index >= total - 1;
    }
};