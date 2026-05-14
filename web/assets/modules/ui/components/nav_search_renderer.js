// Path: web/assets/modules/ui/components/nav_search_renderer.js
import { SearchHighlight } from "utils/search_highlight.js";

export const NavSearchRenderer = {
    render: function(results, query, previewContainer) {
        if (!results || results.length === 0) {
            previewContainer.innerHTML = '<div class="search-preview-empty">Không tìm thấy kết quả</div>';
            return;
        }

        const patterns = SearchHighlight.getRegexPatterns(query);

        previewContainer.innerHTML = results.map((item, index) => {
            const uidHighlight = `<b>${SearchHighlight.highlight(item.uid, patterns, true)}</b>`;
            const aliasIcon = `<svg class="search-preview-alias-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            
            let translatedTitle = "";
            let originalTitle = "";
            let uidPart = "";
            let rawContent = "";

            if (item.type === 'alias' || item.type === 'subleaf') {
                const isAlias = item.type === 'alias';
                const orig = isAlias ? item.target_original_title : item.parent_original_title;
                const trans = isAlias ? item.target_translated_title : item.parent_translated_title;
                
                translatedTitle = trans ? SearchHighlight.highlight(trans, patterns, true) : SearchHighlight.highlight(orig || '', patterns, true);
                originalTitle = trans ? SearchHighlight.highlight(orig || '', patterns, true) : '';
                
                uidPart = `<span class="search-preview-uid">${uidHighlight} ${aliasIcon} ${isAlias ? 'Redirect' : ''}</span>`;
                rawContent = (isAlias ? item.target_blurb : item.parent_blurb) || item.blurb || "";
            } else {
                const orig = item.original_title || '';
                const trans = item.translated_title || '';
                
                translatedTitle = trans ? SearchHighlight.highlight(trans, patterns, true) : SearchHighlight.highlight(orig, patterns, true);
                originalTitle = trans ? SearchHighlight.highlight(orig, patterns, true) : '';
                
                uidPart = `<span class="search-preview-uid">${uidHighlight}</span>`;
                rawContent = item.blurb || "";
            }

            if (!translatedTitle) {
                translatedTitle = "Untitled";
            }

            let displaySnippet = "";
            if (rawContent) {
                displaySnippet = SearchHighlight.highlight(SearchHighlight.smartSnippet(rawContent, patterns, 120), patterns, false);
            }

            return `
                <div class="search-preview-item" data-uid="${item.uid}" data-index="${index}">
                <div class="search-preview-translated-title">${translatedTitle}</div>
                <div class="search-preview-secondary-line">
                    ${originalTitle ? `<span class="search-preview-original-title">${originalTitle}</span>` : '<span></span>'}
                    ${uidPart}
                </div>
                ${displaySnippet ? `<div class="search-blurb-snippet">${displaySnippet}</div>` : ''}
                </div>
            `;
        }).join('');
    }
};