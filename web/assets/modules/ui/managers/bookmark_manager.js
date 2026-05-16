// Path: web/assets/modules/ui/managers/bookmark_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("BookmarkManager");

export const BookmarkManager = {
    STORAGE_KEY: "sutta_bookmarks",

    init() {
        logger.info("Init", "Initializing BookmarkManager...");

        // Listen for external sync updates
        window.addEventListener("sync-data-applied", () => {
            logger.info("Sync", "Sync data applied, re-rendering list");
            this.renderList();
            const params = new URLSearchParams(window.location.search);
            this.updateButtonState(params.get("q"));
        });

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
        window.dispatchEvent(new CustomEvent("local-data-changed"));
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
        const originalEl = document.getElementById("nav-original-title");
        
        const acronym = acronymEl ? acronymEl.textContent.trim() : currentId.toUpperCase();
        const title = titleEl ? titleEl.textContent.trim() : "";
        const original = originalEl ? originalEl.textContent.trim() : "";

        const bookmarks = this.getBookmarks();
        const index = bookmarks.findIndex(b => b.id === currentId);

        if (index > -1) {
            bookmarks[index].deleted = true;
            bookmarks[index].timestamp = Date.now();
            logger.info("Toggle", `Removed (soft-delete): ${currentId}`);
            if (window.MagicNav) window.MagicNav.updateBookmarkState(currentId, false);
        } else {
            const existingDeleted = bookmarks.find(b => b.id === currentId && b.deleted);
            if (existingDeleted) {
                existingDeleted.deleted = false;
                existingDeleted.acronym = acronym;
                existingDeleted.title = title;
                existingDeleted.original = original;
                existingDeleted.timestamp = Date.now();
            } else {
                bookmarks.push({ 
                    id: currentId, 
                    acronym: acronym, 
                    title: title,
                    original: original,
                    timestamp: Date.now() 
                });
            }
            logger.info("Toggle", `Added: ${currentId} (${acronym})`);
            if (window.MagicNav) window.MagicNav.updateBookmarkState(currentId, true);
        }

        this.saveBookmarks(bookmarks);
        this.updateButtonState(currentId);
        this.renderList();
    },

    updateButtonState(currentId) {
        if (!this.btnSave || !currentId) return;
        const baseId = currentId.split('#')[0];
        const bookmarks = this.getBookmarks();
        const isSaved = bookmarks.some(b => b.id === baseId && !b.deleted);
        
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
        const bookmarks = this.getBookmarks().filter(b => !b.deleted);
        
        if (bookmarks.length === 0) {
            this.listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No bookmarks yet.</div>`;
            return;
        }

        // Sort by newest first
        bookmarks.sort((a, b) => b.timestamp - a.timestamp);

        this.listContainer.innerHTML = bookmarks.map(b => {
            const displayAcronym = b.acronym || b.id.toUpperCase();
            const displayTitle = b.title || "";
            const displayOriginal = b.original || "";

            return `
                <div class="bookmark-item" data-id="${b.id}">
                    <div class="bookmark-info">
                        <div class="bookmark-id">
                            <span class="id-acronym">${displayAcronym}</span>
                            ${displayOriginal ? `<span class="id-original">${displayOriginal}</span>` : ''}
                        </div>
                        ${displayTitle ? `<div class="bookmark-title">${displayTitle}</div>` : ''}
                    </div>
                    <button class="bookmark-del-btn" title="Remove">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
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
                    const bIndex = currentBookmarks.findIndex(b => b.id === id);
                    if (bIndex > -1) {
                        currentBookmarks[bIndex].deleted = true;
                        currentBookmarks[bIndex].timestamp = Date.now();
                        this.saveBookmarks(currentBookmarks);
                    }
                    this.renderList();
                    
                    if (window.MagicNav) window.MagicNav.updateBookmarkState(id, false);

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