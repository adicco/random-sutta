// Path: web/assets/modules/lookup/core/lookup_event_handler.js
import { LookupHighlighter } from './lookup_highlighter.js';
import { DictProvider } from 'lookup/dict_provider.js'; // [FIXED] Use alias

export const LookupEventHandler = {
    handleClick(e, onLookupCallback) {
        // [UPDATED] Allow lookup in both main container and Quicklook popup
        const container = e.target.closest(".sutta-text-view");
        if (!container) return;
        
        // [UPDATED] Ignore clicks on links, buttons, existing highlights, AND comment markers
        if (e.target.closest("a, button, .lookup-highlight, .comment-marker")) return;

        // [FIX] Dynamic trigger check based on active dictionaries
        if (!DictProvider.canTrigger(e.target)) return;

        // Clear previous first (Normalize DOM)
        LookupHighlighter.clearHighlight();

        // 1. Get Caret Position
        let range;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.setEnd(pos.offsetNode, pos.offset);
        }

        if (!range || range.startContainer.nodeType !== 3) return;

        const textNode = range.startContainer;
        const offset = range.startOffset;
        const textContent = textNode.textContent;

        // 2. Expand to Word Boundaries
        // [UPDATED] Include all smart quotes and special punctuation
        const delimiters = /[.,;:"'‘’“”\—?!()…\s]/;
        let start = offset;
        let end = offset;

        while (start > 0 && !delimiters.test(textContent[start - 1])) start--;
        while (end < textContent.length && !delimiters.test(textContent[end])) end++;

        if (start === end) return;

        const word = textContent.substring(start, end).trim();
        if (!word) return;

        // 3. Highlight
        const wordRange = document.createRange();
        wordRange.setStart(textNode, start);
        wordRange.setEnd(textNode, end);

        const span = LookupHighlighter.highlightRange(wordRange);
        
        // 4. Update State & Lookup
        if (span) {
            // [UPDATED] Pass the span itself to allow offset calculation
            if (onLookupCallback) onLookupCallback(word, span);
        }
    }
};