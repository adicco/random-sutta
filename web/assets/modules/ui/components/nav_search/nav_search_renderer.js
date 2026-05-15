// Path: web/assets/modules/ui/components/nav_search/nav_search_renderer.js
import { SearchHighlight } from "utils/search_highlight.js";

export const NavSearchRenderer = {
    render: function(results, query, previewContainer) {
        if (!results || results.length === 0) {
            previewContainer.innerHTML = '<div class="nav-search-empty">Không tìm thấy kết quả</div>';
            return;
        }

        const patterns = SearchHighlight.getRegexPatterns(query);

        previewContainer.innerHTML = results.map((item, index) => {
            const uidHighlight = `<b>${SearchHighlight.highlight(item.uid, patterns, true)}</b>`;
            const aliasIcon = `<svg class="nav-search-alias-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            
            let translatedTitle = "";
            let originalTitle = "";
            let uidPart = "";
            let rawContent = "";

            let displaySnippet = "";
            let skipSnippet = false;

            if (item.type === 'alias' || item.type === 'subleaf') {
                const isAlias = item.type === 'alias';
                const orig = isAlias ? item.target_original_title : item.parent_original_title;
                const trans = isAlias ? item.target_translated_title : item.parent_translated_title;
                
                translatedTitle = trans ? SearchHighlight.highlight(trans, patterns, true) : SearchHighlight.highlight(orig || '', patterns, true);
                originalTitle = trans ? SearchHighlight.highlight(orig || '', patterns, true) : '';
                
                uidPart = `<span class="nav-search-uid">${uidHighlight} ${aliasIcon}</span>`;
                
                if (!isAlias && item.translated_title) {
                    const cleanOrig = (item.original_title || "").trim();
                    const cleanTrans = (item.translated_title || "").trim();
                    
                    let parts = [];
                    if (cleanOrig) parts.push(`<i>${cleanOrig}</i>`);
                    if (cleanTrans) parts.push(cleanTrans);
                    
                    rawContent = parts.join(" — ");
                    skipSnippet = true;
                } else {
                    rawContent = (isAlias ? item.target_blurb : item.parent_blurb) || item.blurb || "";
                }
            } else {
                const orig = item.original_title || '';
                const trans = item.translated_title || '';
                
                translatedTitle = trans ? SearchHighlight.highlight(trans, patterns, true) : SearchHighlight.highlight(orig, patterns, true);
                originalTitle = trans ? SearchHighlight.highlight(orig, patterns, true) : '';
                
                uidPart = `<span class="nav-search-uid">${uidHighlight}</span>`;
                rawContent = item.blurb || "";
            }

            if (!translatedTitle) {
                translatedTitle = "Untitled";
            }

            if (rawContent) {
                if (skipSnippet) {
                    displaySnippet = SearchHighlight.highlight(rawContent, patterns, false);
                } else {
                    displaySnippet = SearchHighlight.highlight(SearchHighlight.smartSnippet(rawContent, patterns, 120), patterns, false);
                }
            }

            return `
                <div class="nav-search-item" data-uid="${item.uid}" data-index="${index}">
                <div class="nav-search-meta">
                    ${uidPart}
                    ${originalTitle ? `<span class="nav-search-orig">${originalTitle}</span>` : ''}
                    <span class="nav-search-trans">${translatedTitle}</span>
                </div>
                ${displaySnippet ? `<div class="nav-search-blurb">${displaySnippet}</div>` : ''}
                </div>
            `;
        }).join('');
    }
};