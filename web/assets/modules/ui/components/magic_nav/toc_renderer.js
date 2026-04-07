// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    _containsActiveUid(node, currentUid) {
        if (typeof node === 'string') return node === currentUid;
        if (Array.isArray(node)) return node.some(child => this._containsActiveUid(child, currentUid));
        if (typeof node === 'object' && node !== null) {
            for (const [key, val] of Object.entries(node)) {
                if (key === currentUid) return true;
                if (this._containsActiveUid(val, currentUid)) return true;
            }
        }
        return false;
    },

    render(node, currentUid, metaMap, level = 0, bookmarkedSet = new Set(), historyMap = {}) {
        let html = ``;
        const getToggleIcon = () => `
            <span class="toc-toggle-icon" onclick="event.stopPropagation(); MagicNav.toggleNode(this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>`;

        // [NEW] Helper lấy tooltip (Original Title -> Translated Title)
        const getTooltip = (id) => {
            const m = metaMap[id] || {};
            // Ưu tiên Original Title (Pali) cho tooltip
            if (m.original_title) return m.original_title;
            if (m.translated_title) return m.translated_title;
            return "";
        };

        const getBookmarkIcon = () => `
            <span class="toc-bookmark-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            </span>
        `;

        const generateInnerContent = (id, type) => {
            const meta = metaMap[id] || {};
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";
            
            if (type === 'leaf') {
                // [UPDATED] Add tooltip to toc-text-container
                const tooltip = getTooltip(id);
                return `
                    <div class="toc-text-container" title="${tooltip}">
                        <div class="toc-row-main">${acronym} ${getBookmarkIcon()}</div>
                        ${title ? `<div class="toc-row-sub">${title}</div>` : ''}
                    </div>
                `;
            } else if (type === 'subleaf') {
                return `<div class="toc-subleaf-label" title="${title}">${acronym} ${getBookmarkIcon()}</div>`;
            } else {
                const branchLabel = meta.translated_title || meta.original_title || meta.acronym || id.toUpperCase();
                return `<div class="toc-branch-label">${branchLabel} ${getBookmarkIcon()}</div>`;
            }
        };

        const getLoadAction = (id) => `onclick="window.loadSutta('${id}', true, 0, { transition: false }); MagicNav.closeAll()"`;
        
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const type = meta.type || (level === 0 ? 'leaf' : 'subleaf');
            const isActive = id === currentUid ? "active" : "";
            const isBookmarked = bookmarkedSet.has(id) ? "bookmarked" : "";
            const famLevel = historyMap[id] ? historyMap[id].level : 0;
            const famClass = famLevel > 0 ? `fam-level-${famLevel}` : "";
            const action = isActive ? "" : getLoadAction(id);
            
            const presentationClass = type === 'leaf' ? 'toc-leaf-presentation' : '';
            const paddingLeft = 15 + (level * 16);
            return `<div class="toc-item ${type} ${presentationClass} ${isActive} ${isBookmarked} ${famClass}" data-toc-id="${id}" ${action} style="padding-left: ${paddingLeft}px">
                        ${generateInnerContent(id, type)}
                    </div>`;
        };

        const createParentNode = (id, childrenHtml, currentLevel, rawChildNode) => {
            const meta = metaMap[id] || {};
            const type = meta.type || 'branch'; 
            
            const paddingLeft = 15 + (currentLevel * 10);
            const isActive = id === currentUid;
            const isBookmarked = bookmarkedSet.has(id) ? "bookmarked" : "";
            const famLevel = historyMap[id] ? historyMap[id].level : 0;
            const famClass = famLevel > 0 ? `fam-level-${famLevel}` : "";
            const isClickable = !!metaMap[id];
            
            let headerAction = "";
            if (isClickable && !isActive) {
                headerAction = getLoadAction(id);
            } else if (!isClickable) {
                headerAction = `onclick="MagicNav.toggleNode(this)"`;
            }

            let isCollapsed = false;
            const hasActiveChild = this._containsActiveUid(rawChildNode, currentUid);
            if (type === 'leaf') {
                if (!hasActiveChild && !isActive) isCollapsed = true;
            }
            
            const collapsedClass = isCollapsed ? "collapsed" : "";
            const rowActiveClass = isActive ? "active" : "";
            const presentationClass = type === 'leaf' ? 'toc-leaf-presentation' : '';
            const headerClasses = `toc-header type-${type} ${presentationClass} ${isClickable ? 'clickable' : ''}`;
            
            // [UPDATED] Add tooltip to toc-header-row
            const tooltip = getTooltip(id);

            return `<div class="toc-node-wrapper ${collapsedClass}" data-toc-id="${id}">
                        <div class="toc-header-row ${rowActiveClass} ${isBookmarked} ${famClass}" title="${tooltip}">
                            <div class="${headerClasses}" ${headerAction} style="padding-left: ${paddingLeft}px">
                                ${generateInnerContent(id, type)}
                            </div>
                            ${getToggleIcon()} 
                        </div>
                        <div class="toc-children">${childrenHtml}</div>
                    </div>`;
        };

        if (typeof node === 'string') {
            return createItem(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => html += this.render(child, currentUid, metaMap, level, bookmarkedSet, historyMap));
        } else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1, bookmarkedSet, historyMap);
                html += createParentNode(key, childrenHtml, level, node[key]);
            }
        }
        return html;
    }
};