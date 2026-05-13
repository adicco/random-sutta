// Path: web/assets/modules/ui/views/renderers/search_renderer.js

export const SearchRenderer = {
    render: function(data) {
        const { results, query } = data;
        
        // 1. Prepare highlight patterns (reusing logic from nav_search)
        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        let patterns = [];
        
        queryTerms.forEach(term => {
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            patterns.push(new RegExp(`(?![^<]*>)(${escaped})`, "gi"));
            
            const acronymMatch = term.match(/^([a-z]+)([\d.]+)$/i);
            if (acronymMatch) {
                const alpha = acronymMatch[1];
                const digits = acronymMatch[2].replace(/\./g, '\\.');
                patterns.push(new RegExp(`(?![^<]*>)(${alpha}[\\s.]*${digits})`, "gi"));
            }
        });
        patterns.sort((a, b) => b.source.length - a.source.length);

        const stripHtml = (html) => {
            if (!html) return "";
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return doc.body.textContent || "";
        };

        const highlight = (text, isLine1 = true) => {
            if (!text) return "";
            let highlighted = text;
            const tag = isLine1 ? '<b class="match-highlight">' : '<b>';
            patterns.forEach(regex => {
                highlighted = highlighted.replace(regex, `${tag}$1</b>`);
            });
            return highlighted;
        };

        const smartSnippet = (text) => {
            if (!text) return "";
            const cleanText = stripHtml(text);
            
            let matchPos = -1;
            for (const regex of patterns) {
                const m = regex.exec(cleanText);
                if (m) {
                    matchPos = m.index;
                    break;
                }
            }

            if (matchPos === -1) return cleanText.length > 200 ? cleanText.substring(0, 200) + "..." : cleanText;

            const windowSize = 200; // Larger for full page
            let start = Math.max(0, matchPos - Math.floor(windowSize / 2));
            let end = start + windowSize;

            if (end > cleanText.length) {
                end = cleanText.length;
                start = Math.max(0, end - windowSize);
            }

            let snippet = cleanText.substring(start, end);
            if (start > 0) {
                const firstSpace = snippet.indexOf(" ");
                snippet = "..." + (firstSpace !== -1 ? snippet.substring(firstSpace + 1) : snippet);
            }
            if (end < cleanText.length) {
                const lastSpace = snippet.lastIndexOf(" ");
                snippet = (lastSpace !== -1 ? snippet.substring(0, lastSpace) : snippet) + "...";
            }

            return snippet;
        };

        // 2. Generate HTML
        const resultItems = results.map(item => {
            const uidPart = `<b>${highlight(item.uid, true)}</b>`;
            const aliasIcon = `<svg class="search-preview-alias-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; opacity:0.8; color:var(--primary-color);"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            
            let metaLine = "";
            let rawContent = "";

            if (item.type === 'alias' || item.type === 'subleaf') {
                const title = highlight(item.type === 'alias' ? item.target_original_title : item.parent_original_title, true) || '';
                const trans = highlight(item.type === 'alias' ? item.target_translated_title : item.parent_translated_title, true) || '';
                const separator = title && trans ? ' – ' : '';
                metaLine = `${uidPart} ${aliasIcon} <span>${title}${separator}${trans}</span>`;
                rawContent = (item.type === 'alias' ? item.target_blurb : item.parent_blurb) || item.blurb || "";
            } else {
                const title = highlight(item.original_title || '', true);
                const trans = highlight(item.translated_title || '', true);
                const separator = title && trans ? ' – ' : '';
                metaLine = `${uidPart}: <span>${title}${separator}${trans}</span>`;
                rawContent = item.blurb || "";
            }

            let displaySnippet = "";
            if (rawContent) {
                displaySnippet = highlight(smartSnippet(rawContent), false);
            } else if (item.snippet) {
                displaySnippet = highlight(stripHtml(item.snippet), false);
            }

            const action = `window.loadSutta('${item.uid}', true, 0, { transition: true })`;

            return `
                <a href="?q=${item.uid}" onclick="event.preventDefault(); ${action}" class="search-full-item">
                    <div class="search-full-meta">${metaLine}</div>
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
                uid: query,
                title: "Search Results",
                acronym: "Search"
            }
        };
    }
};
