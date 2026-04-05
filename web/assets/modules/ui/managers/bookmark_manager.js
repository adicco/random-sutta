// Path: web/assets/modules/ui/managers/bookmark_manager.js
import { getLogger } from "utils/logger.js";
import { SuttaController } from "core/sutta_controller.js";

const logger = getLogger("BookmarkManager");

export const BookmarkManager = {
    STORAGE_KEY: "sutta_bookmarks",

    init() {
        this.btnSave = document.getElementById("btn-save-bookmark");
        this.listContainer = document.getElementById("bookmarks-list");
        this.tabToc = document.getElementById("tab-magic-toc");
        this.tabBookmarks = document.getElementById("tab-magic-bookmarks");
        this.contentToc = document.getElementById("magic-toc-content");
        this.contentBookmarks = document.getElementById("magic-bookmarks-content");

        if (this.btnSave) {
            this.btnSave.addEventListener("click", () => this.toggleCurrentSutta());
        }

        if (this.tabToc && this.tabBookmarks) {
            this.tabToc.addEventListener("click", () => this.switchTab("toc"));
            this.tabBookmarks.addEventListener("click", () => this.switchTab("bookmarks"));
        }

        // Render initial list
        this.renderList();
    },

    switchTab(tab) {
        if (tab === "toc") {
            this.tabToc.classList.add("active");
            this.tabBookmarks.classList.remove("active");
            this.contentToc.classList.remove("hidden");
            this.contentBookmarks.classList.add("hidden");
        } else {
            this.tabToc.classList.remove("active");
            this.tabBookmarks.classList.add("active");
            this.contentToc.classList.add("hidden");
            this.contentBookmarks.classList.remove("hidden");
            this.renderList();
        }
    },

    getBookmarks() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            logger.warn("Storage Error", e);
            return [];
        }
    },

    saveBookmarks(bookmarks) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks));
    },

    toggleCurrentSutta() {
        const params = new URLSearchParams(window.location.search);
        const currentId = params.get("q");
        if (!currentId) return;

        // Try to get title from #nav-main-title
        const titleEl = document.getElementById("nav-main-title");
        const title = titleEl ? titleEl.textContent : currentId.toUpperCase();

        const bookmarks = this.getBookmarks();
        const index = bookmarks.findIndex(b => b.id === currentId);

        if (index > -1) {
            bookmarks.splice(index, 1);
            logger.info("Removed Bookmark", currentId);
        } else {
            bookmarks.push({ id: currentId, title: title, timestamp: Date.now() });
            logger.info("Added Bookmark", currentId);
        }

        this.saveBookmarks(bookmarks);
        this.updateButtonState(currentId);
        this.renderList();
    },

    updateButtonState(currentId) {
        if (!this.btnSave) return;
        const bookmarks = this.getBookmarks();
        const isSaved = bookmarks.some(b => b.id === currentId);
        
        if (isSaved) {
            this.btnSave.classList.add("saved");
        } else {
            this.btnSave.classList.remove("saved");
        }
    },

    renderList() {
        if (!this.listContainer) return;
        const bookmarks = this.getBookmarks();
        
        if (bookmarks.length === 0) {
            this.listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No bookmarks yet.</div>`;
            return;
        }

        // Sort by newest first
        bookmarks.sort((a, b) => b.timestamp - a.timestamp);

        this.listContainer.innerHTML = bookmarks.map(b => `
            <div class="bookmark-item" data-id="${b.id}">
                <div class="bookmark-info">
                    <div class="bookmark-title">${b.title}</div>
                    <div class="bookmark-id">${b.id.toUpperCase()}</div>
                </div>
                <button class="bookmark-del-btn" title="Remove">✕</button>
            </div>
        `).join("");

        // Add event listeners
        this.listContainer.querySelectorAll(".bookmark-item").forEach(item => {
            item.addEventListener("click", (e) => {
                if (e.target.closest(".bookmark-del-btn")) {
                    const id = item.getAttribute("data-id");
                    const currentBookmarks = this.getBookmarks();
                    this.saveBookmarks(currentBookmarks.filter(b => b.id !== id));
                    this.renderList();
                    
                    const params = new URLSearchParams(window.location.search);
                    if (params.get("q") === id) this.updateButtonState(id);
                    return;
                }
                
                const id = item.getAttribute("data-id");
                // Use UIManager to close drawer if possible, but UIManager is not imported directly. 
                // We can just click the magic-nav-corner or use app logic.
                const drawer = document.getElementById("magic-toc-drawer");
                const backdrop = document.getElementById("magic-backdrop");
                const wrapper = document.getElementById("magic-nav-wrapper");
                if (drawer) drawer.classList.remove("open");
                if (backdrop) backdrop.classList.add("hidden");
                if (wrapper) wrapper.classList.add("collapsed");
                
                SuttaController.loadSutta(id, true);
            });
        });
    }
};