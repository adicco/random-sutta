// Path: web/assets/modules/utils/search_highlight.js

export const SearchHighlight = {
    charMap: {
        'a': '[aāAĀáàảãạăắằẳẵặâấầẩẫậ]',
        'i': '[iīIĪíìỉĩị]',
        'u': '[uūUŪúùủũụưứừửữự]',
        'e': '[eEéèẻẽẹêếềểễệ]',
        'o': '[oOóòỏõọôốồổỗộơớờởỡợ]',
        'm': '[mṁṃMṀṂ]',
        'n': '[nñṅṇNÑṄṆ]',
        't': '[tṭTṬ]',
        'd': '[dḍDḌđĐ]',
        'l': '[lḷLḶ]'
    },

    getRegexPatterns(query) {
        if (!query) return [];
        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        let patterns = [];

        queryTerms.forEach(term => {
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            let patternStr = '';
            for (const char of escaped) {
                patternStr += this.charMap[char.toLowerCase()] || char;
            }

            patterns.push(new RegExp(`(?![^<]*>)(${patternStr})`, "gi"));

            const acronymMatch = term.match(/^([a-z]+)([\d.]+)$/i);
            if (acronymMatch) {
                let alphaStr = '';
                for (const char of acronymMatch[1]) {
                    alphaStr += this.charMap[char.toLowerCase()] || char;
                }
                const digits = acronymMatch[2].replace(/\./g, '\\.');
                patterns.push(new RegExp(`(?![^<]*>)(${alphaStr}[\\s.]*${digits})`, "gi"));
            }
        });
        
        patterns.sort((a, b) => b.source.length - a.source.length);
        return patterns;
    },

    highlight(text, patterns, isLine1 = true) {
        if (!text || patterns.length === 0) return text || "";
        let highlighted = text;
        const tag = isLine1 ? '<b class="match-highlight">' : '<b>';
        patterns.forEach(regex => {
            highlighted = highlighted.replace(regex, `${tag}$1</b>`);
        });
        return highlighted;
    },

    stripHtml(html) {
        if (!html) return "";
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    },

    smartSnippet(text, patterns, windowSize = 120) {
        if (!text) return "";
        const cleanText = this.stripHtml(text);
        
        if (patterns.length === 0) return cleanText.length > windowSize ? cleanText.substring(0, windowSize) + "..." : cleanText;

        let matchPos = -1;
        for (const regex of patterns) {
            const m = regex.exec(cleanText);
            if (m) {
                matchPos = m.index;
                break;
            }
        }

        if (matchPos === -1) return cleanText.length > windowSize ? cleanText.substring(0, windowSize) + "..." : cleanText;

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
    }
};
