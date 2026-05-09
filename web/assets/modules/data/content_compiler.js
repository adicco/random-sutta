// Path: web/assets/modules/data/content_compiler.js

export const ContentCompiler = {
    // --- 1. RENDER TEXT CONTENT (LEAF) ---
    compile: function (contentMap, rootUid) {
        if (!contentMap) return "";
        
        const sortedKeys = Object.keys(contentMap).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        let html = '<article>';
        
        sortedKeys.forEach(segmentId => {
            const seg = contentMap[segmentId];
            const { pli, eng, html: htmlDecor, comm, reference } = seg;

            let openTag = "";
            let closeTag = "";
            
            if (htmlDecor) {
                const parts = htmlDecor.split("{}");
                if (parts.length === 2) {
                    openTag = parts[0];
                    closeTag = parts[1];
                }
            }

            let segmentHtml = `<span id="${segmentId}" class="segment">`;
            
            // [NEW] Add reference anchors for deep linking (PTS, MS, etc.)
            if (reference) {
                const refs = reference.split(',').map(r => r.trim()).filter(r => r);
                refs.forEach(ref => {
                    segmentHtml += `<a id="${ref}" class="anchor-ref"></a>`;
                });
            }

            if (pli) segmentHtml += `<span class="pli" lang="pi">${pli}</span>`;
            if (eng) segmentHtml += `<span class="eng" lang="en">${eng}</span>`;
            
            if (comm) {
                const safeComm = comm.replace(/"/g, '&quot;');
                segmentHtml += `<span class="comment-marker" title="View note" data-comment="${safeComm}">*</span>`;
            }
            
            segmentHtml += `</span>`; 
            html += `${openTag}${segmentHtml}${closeTag}`;
        });

        html += '</article>';
        return html;
    },

    // --- 2. RENDER BRANCH STRUCTURE (MENU) ---
    compileBranch: function (structure, rootUid, metaMap) {
        if (!structure) return `<div class="error-message">Structure is empty.</div>`;

        const targetNode = this._findNode(structure, rootUid);
        
        if (!targetNode) {
            console.error(`[Compiler] Node '${rootUid}' not found in tree:`, structure);
            return `<div class="error-message">
                <h3>Content Not Found</h3>
                <p>Could not find branch '<b>${rootUid}</b>' in the book structure.</p>
            </div>`;
        }

        let html = `<div class="branch-container">`;
        html += `<ul class="branch-group">`;

        let itemsToRender = [];
        if (Array.isArray(targetNode)) {
            itemsToRender = targetNode;
        } else if (typeof targetNode === 'object' && targetNode !== null) {
            itemsToRender = Object.keys(targetNode);
        }

        if (itemsToRender.length === 0) {
            return `<div class="error-message">Branch '${rootUid}' has no children.</div>`;
        }

        itemsToRender.forEach(item => {
            let uid = null;
            if (typeof item === 'string') {
                uid = item;
            } else if (typeof item === 'object') {
                uid = Object.keys(item)[0];
            }

            if (uid) {
                const info = metaMap[uid] || {};
                const metaType = info.type || 'leaf';
                const isGroup = ['branch', 'book', 'sub_book', 'super_book', 'root'].includes(metaType);
                
                html += this._createCard(uid, metaMap, isGroup ? 'group' : 'leaf');
            }
        });

        html += `</ul>`;
        html += `</div>`;
        return html;
    },

    _findNode: function(tree, targetUid) {
        if (tree[targetUid]) return tree[targetUid];

        let children = [];
        if (Array.isArray(tree)) {
            children = tree;
        } else if (typeof tree === 'object' && tree !== null) {
            children = Object.values(tree);
        }

        for (const child of children) {
            if (typeof child === 'object' && child !== null) {
                if (child[targetUid]) return child[targetUid];
                const found = this._findNode(child, targetUid);
                if (found) return found;
            }
        }
        return null;
    },

    _createCard: function (uid, metaMap, type) {
        const info = metaMap[uid] || {};
        const title = info.translated_title || info.original_title || uid;
        const acronym = info.acronym || uid.toUpperCase();
        
        const cssClass = type === "group" ? "branch-card-group" : "branch-card-leaf";
        
        let badge = "";
        const t = info.type;
        if (t === 'root') badge = `<span class="b-badge">Root</span>`;
        else if (t === 'super_book') badge = `<span class="b-badge">Collection</span>`;
        else if (t === 'sub_book') badge = `<span class="b-badge">Part</span>`;
        else if (t === 'book') badge = `<span class="b-badge">Book</span>`;
        else if (t === 'branch') badge = `<span class="b-badge">Section</span>`;

        // [CHANGED] Luôn hiển thị Blurb nếu có (không phân biệt Group hay Leaf)
        const blurb = info.blurb ? `<div class="b-blurb">${info.blurb}</div>` : "";

        return `
        <li class="${cssClass}">
            <a href="javascript:void(0)" onclick="window.loadSutta('${uid}')" class="b-card-link">
                <div class="b-content">
                    <div class="b-header">
                        <span class="b-title">${title}</span>
                        <span class="b-orig">${acronym}</span>
                    </div>
                    ${blurb}
                    ${badge ? `<div class="b-footer">${badge}</div>` : ''}
                </div>
            </a>
        </li>
        `;
    }
};