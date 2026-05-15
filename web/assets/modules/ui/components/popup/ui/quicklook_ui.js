// Path: web/assets/modules/ui/components/popup/ui/quicklook_ui.js
import { ZIndexManager } from 'ui/common/z_index_manager.js';

export const QuicklookUI = {
    elements: {},
    currentSourceUrl: null, // Store URL for footer click

    init(callbacks) {
        this.elements = {
            popup: document.getElementById("quicklook-popup"),
            content: document.getElementById("quicklook-content"),
            title: document.getElementById("quicklook-title"),
            closeBtn: document.getElementById("close-quicklook"),
            popupBody: document.querySelector("#quicklook-popup .popup-body"),
            footer: document.querySelector(".quicklook-footer") // New Footer
        };

        if (!this.elements.popup) return;

        // [Z-INDEX] Manage stacking order
        ZIndexManager.register(this.elements.popup);

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onClose();
        });

        // [NEW] Footer Click -> Open Original Link
        if (this.elements.footer) {
            this.elements.footer.addEventListener("click", (e) => {
                // Ignore if clicking the close button
                if (e.target.closest("#close-quicklook")) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                if (callbacks.onOpenOriginal && this.currentSourceUrl) {
                    callbacks.onOpenOriginal(this.currentSourceUrl);
                }
            });
        }
        
        this.elements.content.addEventListener("click", (e) => {
             if (e.target.classList.contains("comment-marker")) {
                 e.stopPropagation();
                 if (callbacks.onCommentClick) {
                     callbacks.onCommentClick(e.target.dataset.comment);
                 }
                 return;
             }

             const link = e.target.closest("a");
             if (link && link.href) {
                 e.preventDefault();
                 callbacks.onDeepLink(link.href);
             }
        });
    },

    render(htmlContent, title = "Preview", sourceUrl = null) {
        if (this.elements.title) this.elements.title.innerHTML = title;
        this.elements.content.innerHTML = htmlContent;

        // Store URL for footer interaction
        this.currentSourceUrl = sourceUrl;

        this.elements.popup.classList.remove("hidden");
        document.body.classList.add("quicklook-open");
        
        // [Z-INDEX] Bring to front
        ZIndexManager.bringToFront(this.elements.popup);
        
        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;
    },

    showLoading(title = "Loading...") {
        this.render('<div style="text-align:center; padding: 20px;">Loading...</div>', title);
    },

    showError(msg) {
        this.render(`<p class="error-message">${msg}</p>`, "Error");
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
        document.body.classList.remove("quicklook-open");
        if (this.elements.content) this.elements.content.innerHTML = "";
        this.currentSourceUrl = null;
    },
    
    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    }
};