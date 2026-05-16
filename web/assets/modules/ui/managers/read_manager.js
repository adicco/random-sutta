// Path: web/assets/modules/ui/managers/read_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("ReadManager");

export const ReadManager = {
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
        logger.info("Init", "Initializing ReadManager...");

        // Listen for external sync updates
        window.addEventListener("sync-data-applied", () => {
            logger.info("Sync", "Sync data applied, re-rendering list");
            this.renderList();
            
            // Also need to update the familiarity bar UI for the current sutta if open
            const params = new URLSearchParams(window.location.search);
            const currentId = params.get("q");
            if (currentId && window.FamiliarityBar) {
                 const baseId = currentId.split('#')[0];
                 const level = this.getFamiliarity(baseId);
                 window.FamiliarityBar.updateUIState(baseId, level);
            }
        });

        this.tabToc = document.getElementById("tab-magic-toc");
        this.tabBookmarks = document.getElementById("tab-magic-bookmarks");
        this.tabRead = document.getElementById("tab-magic-read");
        
        this.contentToc = document.getElementById("magic-toc-content");
        this.contentBookmarks = document.getElementById("magic-bookmarks-content");
        this.contentRead = document.getElementById("magic-read-content");
        this.listContainer = document.getElementById("read-list");

        if (this.tabRead) {
            this.tabRead.onclick = () => this.switchTab("read");
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
        if (!this.tabToc || !this.tabBookmarks || !this.tabRead) return;
        
        this.tabToc.classList.remove("active");
        this.tabBookmarks.classList.remove("active");
        this.tabRead.classList.remove("active");
        
        this.contentToc.classList.add("hidden");
        this.contentBookmarks.classList.add("hidden");
        this.contentRead.classList.add("hidden");

        if (tab === "read") {
            this.tabRead.classList.add("active");
            this.contentRead.classList.remove("hidden");
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
        return (history[id] && !history[id].deleted) ? history[id].level : 0;
    },

    getKeepProbability(id) {
        const level = this.getFamiliarity(id);
        return this.WEIGHTS[level] !== undefined ? this.WEIGHTS[level] : 1.0;
    },

    setFamiliarity(id, level, acronym, title, skipRender = false, original = "") {
        const history = this.getHistory();
        
        if (level === 0) {
            if (history[id]) {
                history[id].deleted = true;
                history[id].level = 0;
                history[id].timestamp = Date.now();
            }
            logger.info("Familiarity", `Removed (soft-delete): ${id}`);
        } else {
            // ISO Date string: YYYY-MM-DD
            const dateStr = new Date().toISOString().split('T')[0];
            history[id] = {
                level: level,
                date: dateStr,
                acronym: acronym || (history[id] ? history[id].acronym : id.toUpperCase()),
                title: title || (history[id] ? history[id].title : ""),
                original: original || (history[id] ? history[id].original : ""),
                timestamp: Date.now(),
                deleted: false
            };
            logger.info("Familiarity", `Set: ${id} to level ${level}`);
        }
        
        this.saveHistory(history);
        window.dispatchEvent(new CustomEvent("local-data-changed"));
        
        if (!skipRender) this.renderList();
        
        if (window.MagicNav) {
            window.MagicNav.updateHistoryState(id, level);
        }
    },

    // [NEW] Helper cập nhật DOM tại chỗ trong History List
    _updateItemDOM(itemEl, newLevel) {
        // Xóa class fam-level-* cũ
        for (let i = 1; i <= 5; i++) {
            itemEl.classList.remove(`fam-level-${i}`);
        }
        // Thêm class mới
        if (newLevel > 0) itemEl.classList.add(`fam-level-${newLevel}`);
        // Cập nhật attribute để lần click tiếp theo biết level hiện tại
        itemEl.setAttribute("data-level", newLevel);
    },

    renderList() {
        if (!this.listContainer) return;
        const history = this.getHistory();
        const entries = Object.entries(history).filter(([id, data]) => !data.deleted && data.level > 0);
        
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

            html += `<div class="read-date-header">${displayDate}</div>`;
            
            html += items.map(b => {
                const displayTitle = b.title || "";
                const displayOriginal = b.original || "";
                return `
                    <div class="read-item fam-level-${b.level}" data-id="${b.id}" data-level="${b.level}" data-acronym="${b.acronym}" data-title="${displayTitle.replace(/"/g, '&quot;')}" data-original="${displayOriginal.replace(/"/g, '&quot;')}">
                        <div class="read-indicator"></div>
                        <div class="read-info">
                            <div class="read-id">
                                <span class="id-acronym">${b.acronym}</span>
                                ${displayOriginal ? `<span class="id-original">${displayOriginal}</span>` : ''}
                            </div>
                            ${displayTitle ? `<div class="read-title">${displayTitle}</div>` : ''}
                        </div>
                        <div class="read-actions">
                            <button class="fam-adjust-btn fam-dec" title="Decrease Familiarity">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                            <button class="fam-adjust-btn fam-inc" title="Increase Familiarity">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join("");
        }

        this.listContainer.innerHTML = html;

        // Add event listeners
        this.listContainer.querySelectorAll(".read-item").forEach(item => {
            const id = item.getAttribute("data-id");
            const currentLevel = parseInt(item.getAttribute("data-level"), 10);
            const acronym = item.getAttribute("data-acronym");
            const title = item.getAttribute("data-title");
            const original = item.getAttribute("data-original");

            // Swipe logic
            let startX = 0;
            let startY = 0;
            let isSwiping = false;

            item.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                isSwiping = true;
            }, { passive: true });

            item.addEventListener('touchmove', (e) => {
                if (!isSwiping) return;
                const currentY = e.touches[0].clientY;
                if (Math.abs(currentY - startY) > 20) {
                    isSwiping = false; // Cancel swipe if user scrolls vertically
                }
            }, { passive: true });

            item.addEventListener('touchend', (e) => {
                if (!isSwiping) return;
                const endX = e.changedTouches[0].clientX;
                const deltaX = endX - startX;

                if (Math.abs(deltaX) > 50) {
                    // Lấy level mới nhất từ DOM (phòng trường hợp bấm nhiều lần)
                    const latestLevel = parseInt(item.getAttribute("data-level"), 10);
                    let newLevel = latestLevel;
                    if (deltaX > 0 && latestLevel > 0) {
                        newLevel--; // Swipe Right -> Decrease
                    } else if (deltaX < 0 && latestLevel < 5) {
                        newLevel++; // Swipe Left -> Increase
                    }

                    if (newLevel !== latestLevel) {
                        this.setFamiliarity(id, newLevel, acronym, title, true, original); // skipRender = true
                        this._updateItemDOM(item, newLevel);
                        if (window.FamiliarityBar) window.FamiliarityBar.updateUIState(id, newLevel);
                    }
                }
            });

            // Click logic
            item.onclick = (e) => {
                const decBtn = e.target.closest('.fam-dec');
                const incBtn = e.target.closest('.fam-inc');

                if (decBtn || incBtn) {
                    e.stopPropagation();
                    const latestLevel = parseInt(item.getAttribute("data-level"), 10);
                    let newLevel = latestLevel;
                    if (incBtn && latestLevel < 5) newLevel++;
                    if (decBtn && latestLevel > 0) newLevel--;
                    
                    if (newLevel !== latestLevel) {
                        this.setFamiliarity(id, newLevel, acronym, title, true, original); // skipRender = true
                        this._updateItemDOM(item, newLevel);
                        
                        const barContainers = document.querySelectorAll(`.familiarity-bar-container[data-uid="${id}"]`);
                        barContainers.forEach(container => {
                            const buttons = container.querySelectorAll('.fam-btn');
                            buttons.forEach(btn => {
                                if (parseInt(btn.getAttribute('data-level'), 10) === newLevel) {
                                    btn.classList.add('active');
                                } else {
                                    btn.classList.remove('active');
                                }
                            });
                        });
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
