// Path: web/assets/modules/ui/managers/bookmark_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("BookmarkManager");

export const BookmarkManager = {
    STORAGE_KEY: "sutta_bookmarks",

    init() {
        logger.info("Init", "Initializing BookmarkManager...");
        this.btnSave = document.getElementById("btn-save-bookmark");
        this.listContainer = document.getElementById("bookmarks-list");
        this.tabToc = document.getElementById("tab-magic-toc");
        this.tabBookmarks = document.getElementById("tab-magic-bookmarks");
        this.contentToc = document.getElementById("magic-toc-content");
        this.contentBookmarks = document.getElementById("magic-bookmarks-content");

        if (this.btnSave) {
            this.btnSave.onclick = (e) => {
                e.stopPropagation();
                this.toggleCurrentSutta();
            };
        }

        if (this.tabToc && this.tabBookmarks) {
            this.tabToc.onclick = () => this.switchTab("toc");
            this.tabBookmarks.onclick = () => this.switchTab("bookmarks");
        }

        // Render initial list
        this.renderList();
        
        // Initial state check
        const params = new URLSearchParams(window.location.search);
        this.updateButtonState(params.get("q"));
    },

    switchTab(tab) {
        logger.debug("SwitchTab", tab);
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
        let currentId = params.get("q");
        if (!currentId) {
            logger.warn("Toggle", "No current Sutta ID found in URL");
            return;
        }
        
        // Strip hash
        currentId = currentId.split('#')[0];

        // Get info from header
        const acronymEl = document.getElementById("nav-main-title");
        const titleEl = document.getElementById("nav-sub-title");
        
        const acronym = acronymEl ? acronymEl.textContent.trim() : currentId.toUpperCase();
        const title = titleEl ? titleEl.textContent.trim() : "";

        const bookmarks = this.getBookmarks();
        const index = bookmarks.findIndex(b => b.id === currentId);

        if (index > -1) {
            bookmarks.splice(index, 1);
            logger.info("Toggle", `Removed: ${currentId}`);
        } else {
            bookmarks.push({ 
                id: currentId, 
                acronym: acronym, 
                title: title, 
                timestamp: Date.now() 
            });
            logger.info("Toggle", `Added: ${currentId} (${acronym})`);
        }

        this.saveBookmarks(bookmarks);
        this.updateButtonState(currentId);
        this.renderList();
    },

    updateButtonState(currentId) {
        if (!this.btnSave || !currentId) return;
        const baseId = currentId.split('#')[0];
        const bookmarks = this.getBookmarks();
        const isSaved = bookmarks.some(b => b.id === baseId);
        
        if (isSaved) {
            this.btnSave.classList.add("saved");
            const svg = this.btnSave.querySelector("svg");
            if (svg) svg.setAttribute("fill", "currentColor");
        } else {
            this.btnSave.classList.remove("saved");
            const svg = this.btnSave.querySelector("svg");
            if (svg) svg.setAttribute("fill", "none");
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

        this.listContainer.innerHTML = bookmarks.map(b => {
            const displayAcronym = b.acronym || b.id.toUpperCase();
            const displayTitle = b.title || "";

            return `
                <div class="bookmark-item" data-id="${b.id}">
                    <div class="bookmark-info">
                        <div class="bookmark-title">${displayAcronym}</div>
                        ${displayTitle ? `<div class="bookmark-id">${displayTitle}</div>` : ''}
                    </div>
                    <button class="bookmark-del-btn" title="Remove">✕</button>
                </div>
            `;
        }).join("");

        // Add event listeners
        this.listContainer.querySelectorAll(".bookmark-item").forEach(item => {
            item.onclick = (e) => {
                const id = item.getAttribute("data-id");
                
                if (e.target.closest(".bookmark-del-btn")) {
                    e.stopPropagation();
                    const currentBookmarks = this.getBookmarks();
                    this.saveBookmarks(currentBookmarks.filter(b => b.id !== id));
                    this.renderList();
                    
                    const params = new URLSearchParams(window.location.search);
                    if (params.get("q") && params.get("q").split('#')[0] === id) {
                        this.updateButtonState(id);
                    }
                    return;
                }
                
                // Close drawer logic
                const drawer = document.getElementById("magic-toc-drawer");
                const backdrop = document.getElementById("magic-backdrop");
                const wrapper = document.getElementById("magic-nav-wrapper");
                if (drawer) drawer.classList.remove("open");
                if (backdrop) backdrop.classList.add("hidden");
                if (wrapper) wrapper.classList.add("collapsed");
                
                if (window.loadSutta) {
                    window.loadSutta(id, true);
                }
            };
        });
    }
};