// Path: web/assets/modules/ui/components/magic_nav/magic_nav_controller.js
import { BreadcrumbRenderer } from './breadcrumb_renderer.js';
import { TocRenderer } from './toc_renderer.js';
import { UIManager } from './ui_manager.js';
import { AppConfig } from 'core/app_config.js';
import { BookmarkManager } from 'ui/managers/bookmark_manager.js';
import { ReadManager } from 'ui/managers/read_manager.js';
import { ContentScanner } from './content_scanner.js';
import { HeadingsRenderer } from './headings_renderer.js';

export const MagicNav = {
    _currentTocLevel: 1, // Default expansion level
    _headingsObserver: null,
    _navMode: 'toc', // 'toc' or 'headings'

    init() {
        const els = UIManager.init();
        if (!els.wrapper) return;

        els.btnToc.addEventListener("click", (e) => {
            e.stopPropagation();
            UIManager.toggleTOC();
        });
        els.backdrop.addEventListener("click", () => UIManager.closeAll());

        // Tab Switching Logic
        const tabs = [
            { btn: els.tabNav, content: null }, // Nav is special (toggles TOC/Headings)
            { btn: els.tabBookmarks, content: els.bookmarksContent },
            { btn: els.tabRead, content: els.readContent }
        ];

        tabs.forEach(tab => {
            if (tab.btn) {
                tab.btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.switchTab(tab.btn.id);
                });
            }
        });

        // Toggle Nav Mode Logic
        if (els.btnToggleTopics) {
            els.btnToggleTopics.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleNavMode();
            });
        }

        // [NEW] Event Delegation for Drawer Actions
        els.drawer.addEventListener("click", (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            const id = target.closest('[data-toc-id]')?.getAttribute('data-toc-id');

            if (action === 'toggle') {
                e.stopPropagation();
                this.toggleNode(target);
            } else if (action === 'load' && id) {
                window.loadSutta(id, true, 0, { transition: false });
                this.closeAll();
            } else if (action === 'toc-level-plus') {
                this._currentTocLevel++;
                this.collapseToLevel(this._currentTocLevel);
            } else if (action === 'toc-level-minus') {
                this._currentTocLevel = Math.max(0, this._currentTocLevel - 1);
                this.collapseToLevel(this._currentTocLevel);
            } else if (action === 'toc-collapse-all') {
                this._currentTocLevel = 0;
                this.collapseToLevel(0);
            }
        });
    },

    switchTab(tabId) {
        const els = UIManager.elements;
        const tabs = [
            { id: "tab-magic-nav", btn: els.tabNav },
            { id: "tab-magic-bookmarks", btn: els.tabBookmarks, content: els.bookmarksContent },
            { id: "tab-magic-read", btn: els.tabRead, content: els.readContent }
        ];

        tabs.forEach(tab => {
            const isActive = tab.id === tabId;
            if (isActive) {
                tab.btn?.classList.add("active");
                if (tab.id === "tab-magic-nav") {
                    this._updateNavVisibility();
                    els.btnToggleTopics.style.display = "flex";
                } else {
                    tab.content?.classList.remove("hidden");
                    els.btnToggleTopics.style.display = "none";
                }
            } else {
                tab.btn?.classList.remove("active");
                if (tab.id === "tab-magic-nav") {
                    // [FIX] Hide both navigation content areas when switching away
                    els.tocContent?.classList.add("hidden");
                    els.headingsContent?.classList.add("hidden");
                } else {
                    tab.content?.classList.add("hidden");
                }
            }
        });
        
        // Auto-scroll to active item
        if (tabId === "tab-magic-nav") {
            if (this._navMode === 'toc') UIManager._scrollToActive();
            else {
                setTimeout(() => {
                    const active = els.headingsList.querySelector(".active");
                    if (active) active.scrollIntoView({ block: "center", behavior: "instant" });
                }, 0);
            }
        }
    },

    toggleNavMode() {
        this._navMode = this._navMode === 'toc' ? 'headings' : 'toc';
        this._updateNavVisibility();
        
        // Refresh icons and labels
        const els = UIManager.elements;
        const iconToc = els.btnToggleTopics.querySelector(".icon-toc");
        const iconHeadings = els.btnToggleTopics.querySelector(".icon-headings");
        
        if (this._navMode === 'toc') {
            els.tabNav.textContent = "Contents";
            iconToc.style.display = "block";
            iconHeadings.style.display = "none";
            UIManager._scrollToActive();
        } else {
            els.tabNav.textContent = "Headings";
            iconToc.style.display = "none";
            iconHeadings.style.display = "block";
            setTimeout(() => {
                const active = els.headingsList.querySelector(".active");
                if (active) active.scrollIntoView({ block: "center", behavior: "instant" });
            }, 0);
        }
    },

    _updateNavVisibility() {
        const els = UIManager.elements;
        if (this._navMode === 'toc') {
            els.tocContent.classList.remove("hidden");
            els.headingsContent.classList.add("hidden");
        } else {
            els.tocContent.classList.add("hidden");
            els.headingsContent.classList.remove("hidden");
        }
    },

    updateHeadings() {
        const els = UIManager.elements;
        if (!els.headingsList) return;

        // Reset State
        els.headingsList.innerHTML = "";
        if (this._headingsObserver) this._headingsObserver.disconnect();

        // 1. Scan Data
        const suttaContainer = document.getElementById("sutta-container");
        const scanResult = ContentScanner.scan(suttaContainer);

        // 2. Render
        if (scanResult.mode !== 'none') {
            HeadingsRenderer.renderList(scanResult.items, els.headingsList, {
                onItemClick: () => {} // Don't close drawer on click, just jump
            });

            if (scanResult.mode === 'paragraphs') {
                els.headingsContent.classList.add("headings-mode-paragraphs");
            } else {
                els.headingsContent.classList.remove("headings-mode-paragraphs");
            }

            // 3. Setup Observer for active state
            const idsToTrack = [];
            scanResult.items.forEach(item => {
                if (item.id) idsToTrack.push(item.id);
                if (item.subTexts) {
                    item.subTexts.forEach(sub => {
                        if (sub.id) idsToTrack.push(sub.id);
                    });
                }
            });

            if (idsToTrack.length > 0) {
                this._headingsObserver = new IntersectionObserver((entries) => {
                    const visibleEntries = entries.filter(e => e.isIntersecting);
                    if (visibleEntries.length > 0) {
                        visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                        const topMostTarget = visibleEntries[0];
                        HeadingsRenderer.updateActiveState(topMostTarget.target.id);
                    }
                }, {
                    rootMargin: '-5% 0px -85% 0px', 
                    threshold: 0
                });

                idsToTrack.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) this._headingsObserver.observe(el);
                });
            }
        }
    },

    collapseToLevel(maxLevelIndex) {
        const tocContent = document.getElementById("magic-toc-content");
        if (!tocContent) return;

        const nodes = tocContent.querySelectorAll('.toc-node-wrapper');
        nodes.forEach(node => {
            const level = parseInt(node.getAttribute('data-level') || '0');
            if (level >= maxLevelIndex) {
                node.classList.add('collapsed');
            } else {
                node.classList.remove('collapsed');
            }
        });

        this._expandActiveNodeChain();
    },

    _expandActiveNodeChain() {
        const tocContent = document.getElementById("magic-toc-content");
        const activeItem = tocContent?.querySelector(".toc-item.active") || tocContent?.querySelector(".toc-header-row.active");
        if (activeItem) {
            let parent = activeItem.closest('.toc-node-wrapper');
            while (parent) {
                parent.classList.remove('collapsed');
                parent = parent.parentElement.closest('.toc-node-wrapper');
            }
        }
    },

    toggleTOC() { UIManager.toggleTOC(); },
    closeAll() { UIManager.closeAll(); },

    toggleNode(element) {
        const wrapper = element.closest('.toc-node-wrapper');
        if (wrapper) {
            wrapper.classList.toggle('collapsed');
        }
    },

    updateBookmarkState(id, isBookmarked) {
        const tocContent = document.getElementById("magic-toc-content");
        if (!tocContent) return;

        const item = tocContent.querySelector(`.toc-item[data-toc-id="${id}"]`);
        if (item) {
            if (isBookmarked) item.classList.add("bookmarked");
            else item.classList.remove("bookmarked");
        }

        const wrapper = tocContent.querySelector(`.toc-node-wrapper[data-toc-id="${id}"]`);
        if (wrapper) {
            const headerRow = wrapper.querySelector('.toc-header-row');
            if (headerRow) {
                if (isBookmarked) headerRow.classList.add("bookmarked");
                else headerRow.classList.remove("bookmarked");
            }
        }
    },

    updateHistoryState(id, level) {
        const tocContent = document.getElementById("magic-toc-content");
        if (!tocContent) return;

        const removeOldFam = (element) => {
            for (let i = 1; i <= 5; i++) {
                element.classList.remove(`fam-level-${i}`);
            }
        };

        const item = tocContent.querySelector(`.toc-item[data-toc-id="${id}"]`);
        if (item) {
            removeOldFam(item);
            if (level > 0) item.classList.add(`fam-level-${level}`);
        }

        const wrapper = tocContent.querySelector(`.toc-node-wrapper[data-toc-id="${id}"]`);
        if (wrapper) {
            const headerRow = wrapper.querySelector('.toc-header-row');
            if (headerRow) {
                removeOldFam(headerRow);
                if (level > 0) headerRow.classList.add(`fam-level-${level}`);
            }
        }
    },

    render(localTree, currentUid, contextMeta, superTree, superMeta) {
        let fullPath = BreadcrumbRenderer.findPath(localTree, currentUid);
        let localRootId = fullPath ? fullPath[0] : null;
        
        let structureForLookup = localTree; 

        if (fullPath && superTree && fullPath.length > 0) {
            const rootBookId = fullPath[0];
            const superPath = BreadcrumbRenderer.findPath(superTree, rootBookId);
            if (superPath && superPath.length > 0) {
                if (superPath[superPath.length - 1] === rootBookId) {
                    superPath.pop();
                }
                fullPath = [...superPath, ...fullPath];
            }
            structureForLookup = superTree;
        }
        const finalMeta = { ...superMeta, ...contextMeta };
        const bcHtml = fullPath ? BreadcrumbRenderer.generateHtml(fullPath, finalMeta, localRootId, structureForLookup) : "";
        
        const bookmarks = BookmarkManager.getBookmarks();
        const bookmarkedSet = new Set(bookmarks.map(b => b.id));
        const historyMap = ReadManager.getHistory();

        const tocHtml = TocRenderer.render(localTree, currentUid, finalMeta, 0, bookmarkedSet, historyMap);
        UIManager.updateContent(bcHtml, tocHtml);
        UIManager.setHidden(!fullPath);

        this.collapseToLevel(this._currentTocLevel);
        
        // [NEW] Update Headings tab
        this.updateHeadings();

        // Ensure correct sub-mode visibility
        this._updateNavVisibility();
    }
};

window.MagicNav = MagicNav;