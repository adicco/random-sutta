// Path: web/assets/modules/ui/components/magic_nav/breadcrumb_renderer.js
export const BreadcrumbRenderer = {
    findPath(structure, targetUid, currentPath = []) {
        if (!structure) return null;
        if (typeof structure === 'string') {
            return structure === targetUid ?
                [...currentPath, structure] : null;
        }
        if (Array.isArray(structure)) {
            for (const child of structure) {
                const result = this.findPath(child, targetUid, currentPath);
                if (result) return result;
            }
            return null;
        }
        if (typeof structure === 'object' && structure !== null) {
            for (const key in structure) {
                const newPath = [...currentPath, key];
                if (key === targetUid) return newPath;
                const result = this.findPath(structure[key], targetUid, newPath);
                if (result) return result;
            }
        }
        return null;
    },

    // Helper: Kiểm tra xem UID này có phải là Single Parent trong cây không
    _isSingleChain(uid, structure) {
        if (!structure) return false;
        // Tìm node trong tree tương ứng với uid
        const findNode = (node, targetId) => {
            if (typeof node === 'string') return node === targetId ? 'LEAF' : null;
            if (Array.isArray(node)) {
                for (const child of node) {
                    const res = findNode(child, targetId);
                    if (res) return res;
                }
                return null;
            }
            if (typeof node === 'object') {
                if (node[targetId]) return node[targetId]; // Found it
                for (const key in node) {
                    const res = findNode(node[key], targetId);
                    if (res) return res;
                }
            }
            return null;
        };

        const nodeContent = findNode(structure, uid);
        
        // Logic: Nó là single chain nếu node đó là Array có đúng 1 phần tử
        if (Array.isArray(nodeContent) && nodeContent.length === 1) {
            const child = nodeContent[0];
            if (typeof child === 'string') return child;
            if (typeof child === 'object') {
                const keys = Object.keys(child);
                if (keys.length === 1) return keys[0];
            }
        }
        return false;
    },

    // [NEW] Helper để lấy thông tin hiển thị và tooltip
    _getNodeInfo(id, metaMap) {
        const m = metaMap[id] || {};
        // 1. Label: Ưu tiên Acronym để ngắn gọn
        const label = m.acronym || m.original_title || id.toUpperCase();
        
        // 2. Title (Tooltip): Ưu tiên tên dịch đầy đủ
        let title = "";
        if (m.translated_title) title = m.translated_title;
        else if (m.original_title) title = m.original_title;
        
        // Nếu title trùng label (vd: Tipitaka), không cần tooltip lặp lại (hoặc giữ nguyên tùy ý)
        if (title.toLowerCase() === label.toLowerCase()) title = "";

        return { label, title };
    },

    generateHtml(path, metaMap, localRootId = null, fullTree = null) {
        let html = `<ol>`;
        
        for (let i = 0; i < path.length; i++) {
            const uid = path[i];
            
            // [UPDATED] Thu thập cả Label (hiển thị) và Title (hover)
            let labelParts = [];
            let titleParts = [];
            
            let currentId = uid;
            let targetId = uid; // ID dùng để load khi click (thường là node con cuối cùng trong chuỗi gộp)

            const info = this._getNodeInfo(currentId, metaMap);
            labelParts.push(info.label);
            if (info.title) titleParts.push(info.title);

            // Vòng lặp look-ahead để gộp node (Single Chain)
            while (i + 1 < path.length) {
                const nextId = path[i+1];
                const singleChildId = this._isSingleChain(currentId, fullTree);
                
                if (singleChildId === nextId) {
                    const nextInfo = this._getNodeInfo(nextId, metaMap);
                    
                    labelParts.push(nextInfo.label);
                    if (nextInfo.title) titleParts.push(nextInfo.title);
                    
                    currentId = nextId;
                    targetId = nextId;
                    i++; 
                } else {
                    break;
                }
            }

            const isLast = i === path.length - 1;
            const isRoot = (i === 0 && labelParts.length === 1) || uid === localRootId;
            const markerClass = isRoot ? " bc-root-marker" : "";
            
            // Join Label: Dùng gạch ngang nhỏ
            const finalLabel = labelParts.join('<span class="bc-sep-mini">-</span>');
            
            // [NEW] Join Title: Dùng dấu chấm tròn để ngăn cách các cấp độ trong tooltip
            const finalTooltip = titleParts.join(' • ');

            if (html !== `<ol>`) html += `<li class="bc-sep">/</li>`; 

            // [UPDATED] Inject title attribute
            if (isLast) {
                html += `<li class="bc-item active${markerClass}" title="${finalTooltip}">${finalLabel}</li>`;
            } else {
                html += `<li><button data-target="${targetId}" class="bc-link${markerClass}" title="${finalTooltip}">${finalLabel}</button></li>`;
            }
        }

        html += `<li id="magic-bc-end"></li>`;
        html += `</ol>`;
        return html;
    }
};