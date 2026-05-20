// Path: web/assets/modules/ui/components/popup/formatters/comment_formatter.js

export const CommentFormatter = {
    /**
     * Applies styling to prefixes and dividers within a raw text string.
     */
    formatText(text) {
        if (!text) return "";
        // 1. Style all numbered prefixes globally (e.g., "1. ", "11. ")
        let html = text.trim().replace(/(\d+)\.\s/g, '<span class="comment-prefix">$1.</span> ');

        // 2. Style all dividers (|) globally for consistent visual separation
        html = html.replace(/\|/g, '<span class="comment-divider">|</span>');

        return html;
    },

    /**
     * Formats a single comment and wraps it in a paragraph.
     */
    formatSingle(text) {
        if (!text) return "";
        const formattedText = this.formatText(text);
        return `<p class="comment-paragraph">${formattedText}</p>`;
    },

    /**
     * Formats an array of comment objects {text, index}, wrapping each in its own paragraph,
     * and joins them together into a single HTML string.
     */
    formatMultiple(items) {
        if (!Array.isArray(items) || items.length === 0) return "";
        return items.map(item => {
            const formattedText = this.formatText(item.text);
            return `<p class="comment-paragraph" data-index="${item.index}">${formattedText}</p>`;
        }).join("");
    }
};
