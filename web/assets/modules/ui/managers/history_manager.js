// Path: web/assets/modules/ui/managers/history_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("HistoryManager");

export const HistoryManager = {
    STORAGE_KEY: "sutta_history",
    
    // Config: rejection probabilities for Random
    WEIGHTS: {
        0: 1.0, // 100% chance to keep
        1: 0.9, // 90%
        2: 0.7, // 70%
        3: 0.5, // 50%
        4: 0.3, // 30%
        5: 0.1  // 10%
    },

    init() {
        logger.info("Init", "Initializing HistoryManager...");
        this.tabToc = document.getElementById("tab-magic-toc");
        this.tabBookmarks = document.getElementById("tab-magic-bookmarks");
        this.tabHistory = document.getElementById("tab-magic-history");
        
        this.contentToc = document.getElementById("magic-toc-content");
        this.contentBookmarks = document.getElementById("magic-bookmarks-content");
        this.contentHistory = document.getElementById("magic-history-content");
        this.listContainer = document.getElementById("history-list");

        if (this.tabHistory) {
            this.tabHistory.onclick = () => this.switchTab("history");
        }

        // We also need to hook into the other tabs to handle switching
        if (this.tabToc) {
            const oldTocClick = this.tabToc.onclick;
            this.tabToc.onclick = (e) => {
                if (oldTocClick) oldTocClick(e);
                this.switchTab("toc");
            };
        }
        if (this.tabBookmarks) {
            const oldBmClick = this.tabBookmarks.onclick;
            this.tabBookmarks.onclick = (e) => {
                if (oldBmClick) oldBmClick(e);
                this.switchTab("bookmarks");
            };
        }

        this.renderList();
    },

    switchTab(tab) {
        if (!this.tabToc || !this.tabBookmarks || !this.tabHistory) return;
        
        this.tabToc.classList.remove("active");
        this.tabBookmarks.classList.remove("active");
        this.tabHistory.classList.remove("active");
        
        this.contentToc.classList.add("hidden");
        this.contentBookmarks.classList.add("hidden");
        this.contentHistory.classList.add("hidden");

        if (tab === "history") {
            this.tabHistory.classList.add("active");
            this.contentHistory.classList.remove("hidden");
            this.renderList();
        } else if (tab === "toc") {
            this.tabToc.classList.add("active");
            this.contentToc.classList.remove("hidden");
        } else if (tab === "bookmarks") {
            this.tabBookmarks.classList.add("active");
            this.contentBookmarks.classList.remove("hidden");
        }
    },

    getHistory() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            logger.warn("Storage Error", e);
            return {};
        }
    },

    saveHistory(history) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    },

    getFamiliarity(id) {
        const history = this.getHistory();
        return history[id] ? history[id].level : 0;
    },

    getKeepProbability(id) {
        const level = this.getFamiliarity(id);
        return this.WEIGHTS[level] !== undefined ? this.WEIGHTS[level] : 1.0;
    },

    setFamiliarity(id, level, acronym, title) {
        const history = this.getHistory();
        
        if (level === 0) {
            delete history[id];
            logger.info("Familiarity", `Removed: ${id}`);
        } else {
            // ISO Date string: YYYY-MM-DD
            const dateStr = new Date().toISOString().split('T')[0];
            history[id] = {
                level: level,
                date: dateStr,
                acronym: acronym || id.toUpperCase(),
                title: title || ""
            };
            logger.info("Familiarity", `Set: ${id} to level ${level}`);
        }
        
        this.saveHistory(history);
        this.renderList();
        
        if (window.MagicNav) {
            window.MagicNav.updateHistoryState(id, level);
        }
    },

    renderList() {
        if (!this.listContainer) return;
        const history = this.getHistory();
        const entries = Object.entries(history);
        
        if (entries.length === 0) {
            this.listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No history yet.</div>`;
            return;
        }

        // Group by Date
        const grouped = {};
        entries.forEach(([id, data]) => {
            if (!grouped[data.date]) grouped[data.date] = [];
            grouped[data.date].push({ id, ...data });
        });

        // Sort dates descending
        const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

        let html = "";
        for (const date of sortedDates) {
            const items = grouped[date];
            // Sort items within a date by level (highest first), then acronym
            items.sort((a, b) => {
                if (b.level !== a.level) return b.level - a.level;
                return a.acronym.localeCompare(b.acronym);
            });

            // Format date for display
            const displayDate = new Date(date).toLocaleDateString(undefined, { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });

            html += `<div class="history-date-header">${displayDate}</div>`;
            
            html += items.map(b => {
                const displayTitle = b.title || "";
                return `
                    <div class="history-item fam-level-${b.level}" data-id="${b.id}">
                        <div class="history-indicator"></div>
                        <div class="history-info">
                            <div class="history-id">${b.acronym}</div>
                            ${displayTitle ? `<div class="history-title">${displayTitle}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join("");
        }

        this.listContainer.innerHTML = html;

        // Add event listeners
        this.listContainer.querySelectorAll(".history-item").forEach(item => {
            item.onclick = (e) => {
                const id = item.getAttribute("data-id");
                
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
