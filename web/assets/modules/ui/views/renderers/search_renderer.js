// Path: web/assets/modules/ui/views/renderers/search_renderer.js
import { SearchHighlight } from "utils/search_highlight.js";

export const SearchRenderer = {
    render: function(data) {
        const { results, query } = data;
        
        const patterns = SearchHighlight.getRegexPatterns(query);

        // 2. Generate HTML
        const resultItems = results.map(item => {
            const uidPart = SearchHighlight.highlight(item.uid, patterns, true);
            const aliasIcon = `<svg class="search-preview-alias-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; opacity:0.8; color:var(--primary-color); display:inline-block; vertical-align:middle; margin:0 4px;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            
            let mainTitle = "";
            let subMeta = "";
            let rawContent = "";

            if (item.type === 'alias' || item.type === 'subleaf') {
                const isAlias = item.type === 'alias';
                const orig = isAlias ? item.target_original_title : item.parent_original_title;
                const trans = isAlias ? item.target_translated_title : item.parent_translated_title;
                
                mainTitle = trans ? SearchHighlight.highlight(trans, patterns, true) : SearchHighlight.highlight(orig || '', patterns, true);
                const metaTitle = trans ? SearchHighlight.highlight(orig || '', patterns, true) : '';
                
                subMeta = metaTitle ? `<b>${uidPart}</b> ${aliasIcon} ${metaTitle}` : `<b>${uidPart}</b> ${aliasIcon} Redirect`;
                rawContent = (isAlias ? item.target_blurb : item.parent_blurb) || item.blurb || "";
            } else {
                const orig = item.original_title || '';
                const trans = item.translated_title || '';
                
                mainTitle = trans ? SearchHighlight.highlight(trans, patterns, true) : SearchHighlight.highlight(orig, patterns, true);
                const metaTitle = trans ? SearchHighlight.highlight(orig, patterns, true) : '';
                
                subMeta = metaTitle ? `<b>${uidPart}</b> • ${metaTitle}` : `<b>${uidPart}</b>`;
                rawContent = item.blurb || "";
            }

            // Fallback if no title at all
            if (!mainTitle) mainTitle = uidPart;

            let displaySnippet = "";
            if (rawContent) {
                displaySnippet = SearchHighlight.highlight(SearchHighlight.smartSnippet(rawContent, patterns, 250), patterns, false);
            } else if (item.snippet) {
                displaySnippet = SearchHighlight.highlight(SearchHighlight.stripHtml(item.snippet), patterns, false);
            }

            const action = `window.loadSutta('${item.uid}', true, 0, { transition: true })`;

            return `
                <a href="?q=${item.uid}" onclick="event.preventDefault(); ${action}" class="search-full-item">
                    <div class="search-full-title">${mainTitle}</div>
                    <div class="search-full-meta">${subMeta}</div>
                    ${displaySnippet ? `<div class="search-full-snippet">${displaySnippet}</div>` : ''}
                </a>
            `;
        }).join('');

        const html = `
            <div class="search-results-container">
                <div class="search-header">
                    <h1 class="search-title">Search Results</h1>
                    <div class="search-stats">Found ${results.length} matches for "${query}"</div>
                </div>
                <div class="search-result-group">
                    ${resultItems}
                </div>
            </div>
        `;

        return {
            html,
            displayInfo: {
                main: query,
                sub: "Search Results"
            }
        };
    }
};
