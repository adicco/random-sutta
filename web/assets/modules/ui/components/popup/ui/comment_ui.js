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
        
        let cleanText = text || "";
        let supTag = "";

        // [UPDATED] Extract sequence number and wrap in <sup> instead of stripping
        const match = cleanText.match(/^(\d+)\.\s/);
        if (match) {
            supTag = `<sup class="comment-sup">${match[1]}</sup> `;
            cleanText = cleanText.replace(/^\d+\.\s/, "");
        }

        // [UPDATED] Split by | and wrap in paragraphs
        let contentHtml = "";
        if (cleanText && cleanText.includes('|')) {
            const paragraphs = cleanText.split('|')
                .map(p => p.trim())
                .filter(p => p.length > 0);
            
            // Prepend supTag to the first paragraph
            if (paragraphs.length > 0) {
                paragraphs[0] = supTag + paragraphs[0];
            }

            contentHtml = paragraphs
                .map(p => `<p class="comment-paragraph">${p}</p>`)
                .join('');
        } else {
            contentHtml = `<p class="comment-paragraph">${supTag}${cleanText}</p>`;
        }
        
        this.elements.content.innerHTML = contentHtml;
        
        if (this.elements.headerContext) {
            // [UPDATED] Remove double quotes
            this.elements.headerContext.textContent = contextText || "";
            this.elements.headerContext.scrollLeft = 0;
        }

        // [Z-INDEX] Bring to front
        ZIndexManager.bringToFront(this.elements.popup);

        this.elements.popup.classList.remove("hidden");
        document.body.classList.add("popup-open"); // [NEW] Add class to body

        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;

        this._updateNav(index, total);
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