// Path: web/assets/modules/tts/core/tts_dom_parser.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("TTS_DOMParser");

export const TTSDOMParser = {
    /**
     * Quét container để tạo playlist.
     * @returns {Array<{id: string, text: string, element: HTMLElement}>}
     */
    parse(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];

        const segments = Array.from(container.querySelectorAll(".segment"));
        
        const playlist = segments
            // 1. Filter: Chỉ lấy element đang hiển thị (tôn trọng display: none)
            .filter(seg => seg.offsetParent !== null)
            .map(seg => {
                const transEl = seg.querySelector(".trans");
                if (!transEl) return null;
                
                let text = transEl.textContent.trim();
                // Clean citation references [1], [2]...
                text = text.replace(/\[\d+\]/g, "");

                if (text.length === 0) return null;

                return {
                    id: seg.id,
                    text: text,
                    element: seg
                };
            })
            .filter(item => item !== null);

        logger.info("Parse", `Extracted ${playlist.length} segments.`);
        return playlist;
    },

    /**
     * Group segments by parent element (Paragraph/Block mode)
     */
    parseParagraphs(containerId) {
        // Reuse the logic to get valid segments
        const rawSegments = this.parse(containerId);
        if (rawSegments.length === 0) return [];

        const blocks = [];
        let currentBlock = null;

        // Semantic Block Selectors: These are the elements we want to treat as "Paragraphs"
        const blockSelectors = 'p, blockquote, h1, h2, h3, h4, h5, h6, li, article, section, .sutta-text-view > div';

        rawSegments.forEach(item => {
            // [FIX] Instead of direct parent, find the closest semantic block.
            // This fixes issues where segments are inside <span class="evam"> inside a <p>.
            // We want the <p> to be the block, not the <span>.
            let parent = item.element.closest(blockSelectors);
            
            // Fallback: If no semantic block found (rare), use direct parent
            if (!parent) parent = item.element.parentElement;
            
            if (currentBlock && currentBlock.element === parent) {
                // Same block, append
                currentBlock.text += " " + item.text;
                currentBlock.segments.push(item);
            } else {
                // New block
                currentBlock = {
                    id: item.id, // Use first segment's ID as anchor
                    text: item.text,
                    element: parent, // Highlight parent (the Block)
                    segments: [item]
                };
                blocks.push(currentBlock);
            }
        });

        logger.info("ParsePara", `Grouped into ${blocks.length} blocks.`);
        return blocks;
    }
};