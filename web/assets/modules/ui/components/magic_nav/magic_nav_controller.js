// Path: web/assets/modules/ui/components/magic_nav/magic_nav_controller.js
import { BreadcrumbRenderer } from './breadcrumb_renderer.js';
import { TocRenderer } from './toc_renderer.js';
import { UIManager } from './ui_manager.js';
import { AppConfig } from 'core/app_config.js';
import { BookmarkManager } from 'ui/managers/bookmark_manager.js';

import { HistoryManager } from 'ui/managers/history_manager.js';

export const MagicNav = {
    _closeTimer: null,

    init() {
        const els = UIManager.init();
        if (!els.wrapper) return;

        els.btnToc.addEventListener("click", (e) => {
            e.stopPropagation();
            UIManager.toggleTOC();
        });
        els.backdrop.addEventListener("click", () => UIManager.closeAll());
        
        els.bar.addEventListener("mouseleave", () => {
            if (UIManager.isBreadcrumbExpanded()) {
                this._closeTimer = setTimeout(() => UIManager.closeAll(), AppConfig.MAGIC_NAV_COOLDOWN); 
            }
        });
        els.bar.addEventListener("mouseenter", () => {
            if (this._closeTimer) {
                clearTimeout(this._closeTimer);
                this._closeTimer = null;
            }
        });
    },

    toggleTOC() { UIManager.toggleTOC(); },
    
    // [NEW] Thêm hàm này để Renderer gọi được
    closeAll() { UIManager.closeAll(); },

    toggleNode(element) {
        const wrapper = element.closest('.toc-node-wrapper');
        if (wrapper) {
            wrapper.classList.toggle('collapsed');
            const icon = wrapper.querySelector('.toc-toggle-icon svg');
            if (icon) {
            }
        }
    },

    // [NEW] Cập nhật DOM trực tiếp khi toggle bookmark
    updateBookmarkState(id, isBookmarked) {
        const tocContent = document.getElementById("magic-toc-content");
        if (!tocContent) return;

        // Leaf items
        const item = tocContent.querySelector(`.toc-item[data-toc-id="${id}"]`);
        if (item) {
            if (isBookmarked) item.classList.add("bookmarked");
            else item.classList.remove("bookmarked");
        }

        // Branch items (header row)
        const wrapper = tocContent.querySelector(`.toc-node-wrapper[data-toc-id="${id}"]`);
        if (wrapper) {
            const headerRow = wrapper.querySelector('.toc-header-row');
            if (headerRow) {
                if (isBookmarked) headerRow.classList.add("bookmarked");
                else headerRow.classList.remove("bookmarked");
            }
        }
    },

    // [NEW] Cập nhật DOM trực tiếp khi thay đổi Familiarity
    updateHistoryState(id, level) {
        const tocContent = document.getElementById("magic-toc-content");
        if (!tocContent) return;

        // Xóa class fam-level-* cũ
        const removeOldFam = (element) => {
            for (let i = 1; i <= 5; i++) {
                element.classList.remove(`fam-level-${i}`);
            }
        };

        // Leaf items
        const item = tocContent.querySelector(`.toc-item[data-toc-id="${id}"]`);
        if (item) {
            removeOldFam(item);
            if (level > 0) item.classList.add(`fam-level-${level}`);
        }

        // Branch items (header row)
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
        
        // Cây dùng để tra cứu cấu trúc (ưu tiên superTree nếu có để nhìn được toàn cảnh)
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
            structureForLookup = superTree; // Dùng SuperTree để check single-chain
        }
        const finalMeta = { ...superMeta, ...contextMeta };
        
        // [UPDATED] Truyền structureForLookup vào tham số thứ 4
        const bcHtml = fullPath ? BreadcrumbRenderer.generateHtml(fullPath, finalMeta, localRootId, structureForLookup) : "";
        
        // [NEW] Lấy danh sách bookmark hiện tại
        const bookmarks = BookmarkManager.getBookmarks();
        const bookmarkedSet = new Set(bookmarks.map(b => b.id));
        
        // [NEW] Lấy lịch sử độ quen thuộc
        const historyMap = HistoryManager.getHistory();

        const tocHtml = TocRenderer.render(localTree, currentUid, finalMeta, 0, bookmarkedSet, historyMap);
        UIManager.updateContent(bcHtml, tocHtml);
        UIManager.setHidden(!fullPath);
    }
};

window.MagicNav = MagicNav;