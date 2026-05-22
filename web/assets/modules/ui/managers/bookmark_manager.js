// Path: web/assets/modules/ui/managers/bookmark_manager.js
import { getLogger } from "utils/logger.js";
import { SuttaRepository } from "data/sutta_repository.js";

const logger = getLogger("BookmarkManager");

export const BookmarkManager = {
    STORAGE_KEY: "sutta_bookmarks",

    init() {
        logger.info("Init", "Initializing BookmarkManager...");

        this.btnSave = document.getElementById("btn-save-bookmark");

        // Listen for external sync updates
        window.addEventListener("sync-data-applied", () => {
            logger.info("Sync", "Sync data applied, re-rendering list");
            this.renderList();
            const params = new URLSearchParams(window.location.search);
            this.updateButtonState(params.get("q"));
        });
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
            let rawData = data ? JSON.parse(data) : {};
            
            // [MIGRATION] Migrate any legacy formats (Array or Object) to Signed Timestamp
            let migrated = false;
            
            if (Array.isArray(rawData)) {
                logger.info("Migration", "Converting bookmarks from Array to Signed Timestamp format");
                const migratedData = {};
                rawData.forEach(b => {
                    const uid = b.uid || b.id;
                    if (uid) {
                        const ts = b.timestamp || Date.now();
                        const status = b.status !== undefined ? b.status : !b.deleted;
                        migratedData[uid] = status ? Math.abs(ts) : -Math.abs(ts);
                    }
                });
                rawData = migratedData;
                migrated = true;
            } else {
                // Check if it's an object of objects and convert to object of numbers
                Object.keys(rawData).forEach(uid => {
                    const item = rawData[uid];
                    if (typeof item === 'object' && item !== null) {
                        const ts = item.timestamp || Date.now();
                        const status = item.status !== undefined ? item.status : !item.deleted;
                        rawData[uid] = status ? Math.abs(ts) : -Math.abs(ts);
                        migrated = true;
                    }
                });
            }

            if (migrated) {
                logger.info("Migration", "Converted bookmarks to Signed Timestamp format");
                this.saveBookmarks(rawData, true); // Silent
            }

            return rawData;
        } catch (e) {
            logger.warn("Storage Error", e);
            return {};
        }
    },

    saveBookmarks(bookmarks, silent = false) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks));
        if (!silent) {
            window.dispatchEvent(new CustomEvent("local-data-changed"));
        }
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

        const bookmarks = this.getBookmarks();
        const isCurrentlySaved = bookmarks[currentId] && bookmarks[currentId] > 0;
        const newStatus = !isCurrentlySaved;
        
        // Apply signed timestamp
        bookmarks[currentId] = newStatus ? Date.now() : -Date.now();
        
        logger.info("Toggle", `${newStatus ? 'Saved' : 'Removed'}: ${currentId}`);
        if (window.MagicNav) window.MagicNav.updateBookmarkState(currentId, newStatus);

        this.saveBookmarks(bookmarks);
        this.updateButtonState(currentId);
        this.renderList();
    },

    updateButtonState(currentId) {
        if (!this.btnSave || !currentId) return;
        const baseId = currentId.split('#')[0];
        const bookmarks = this.getBookmarks();
        const isSaved = bookmarks[baseId] && bookmarks[baseId] > 0;
        
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

    async renderList() {
        if (!this.listContainer) return;
        
        const allBookmarks = this.getBookmarks();
        const activeEntries = Object.entries(allBookmarks)
            .filter(([uid, val]) => val > 0)
            .map(([uid, val]) => ({ uid, timestamp: val }));
        
        if (activeEntries.length === 0) {
            this.listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No bookmarks yet.</div>`;
            return;
        }

        // Fetch metadata for all active bookmarks
        const uids = activeEntries.map(b => b.uid);
        const metaList = await SuttaRepository.fetchMetaList(uids);

        // Sort by newest first
        activeEntries.sort((a, b) => b.timestamp - a.timestamp);

        this.listContainer.innerHTML = activeEntries.map(b => {
            const meta = metaList[b.uid] || {};
            const displayAcronym = meta.acronym || b.uid.toUpperCase();
            const displayTitle = meta.translated_title || "";
            const displayOriginal = meta.original_title || "";

            return `
                <div class="bookmark-item" data-id="${b.uid}">
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
                const uid = item.getAttribute("data-id");
                
                if (e.target.closest(".bookmark-del-btn")) {
                    e.stopPropagation();
                    const currentBookmarks = this.getBookmarks();
                    if (currentBookmarks[uid]) {
                        currentBookmarks[uid] = -Math.abs(Date.now()); // Negative timestamp to delete
                        this.saveBookmarks(currentBookmarks);
                    }
                    this.renderList();
                    
                    if (window.MagicNav) window.MagicNav.updateBookmarkState(uid, false);

                    const params = new URLSearchParams(window.location.search);
                    if (params.get("q") && params.get("q").split('#')[0] === uid) {
                        this.updateButtonState(uid);
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
                    window.loadSutta(uid, true);
                }
            };
        });
    }
};