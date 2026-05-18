// Path: web/assets/modules/ui/components/magic_nav/content_scanner.js
import { extractParagraphNumber, getCleanTextContent } from './text_utils.js';

export const ContentScanner = {
    /**
     * Quét container để tìm dữ liệu cho mục lục.
     * @param {HTMLElement} container 
     * @returns {Object} { mode: 'headings'|'paragraphs'|'none', items: Array }
     */
    scan(container) {
        // ... (Giữ nguyên logic scan headings và paragraphs) ...
        // 1. Chiến lược A: Tìm Heading cấu trúc (h2 trở lên)
        const headings = container.querySelectorAll("h2, h3, h4, h5");
        if (headings.length >= 2) {
            const uniqueArticleIds = new Set();
            headings.forEach(h => {
                const parentArticle = h.closest('article');
                if (parentArticle && parentArticle.id) {
                    uniqueArticleIds.add(parentArticle.id);
                }
            });
            const useArticlePrefix = uniqueArticleIds.size > 1;
            return {
                mode: 'headings',
                items: Array.from(headings).map((h, index) => 
                    this._parseHeading(h, index, useArticlePrefix)
                )
            };
        }

        // 2. Chiến lược B: Paragraph Scan (Fallback)
        const paragraphs = container.querySelectorAll("p");
        const validItems = [];

        paragraphs.forEach(p => {
            const firstSeg = p.querySelector(".segment");
            if (firstSeg && firstSeg.id) {
                if (firstSeg.textContent.trim().length > 0) {
                    validItems.push(this._parseParagraph(firstSeg));
                }
            }
        });

        if (validItems.length >= 1) {
            return { mode: 'paragraphs', items: validItems };
        }

        return { mode: 'none', items: [] };
    },

    _parseHeading(heading, index, useArticlePrefix) {
        if (!heading.id) {
            heading.id = `headings-heading-${index}`;
        }

        let prefix = null;
        if (useArticlePrefix) {
            const parent = heading.closest('article');
            if (parent && parent.id) {
                prefix = parent.id;
            }
        }

        const subTexts = [];
        let description = null; // [NEW] Biến chứa câu mô tả (từ đoạn văn đầu tiên)
        let isFirstContentFound = false; // Cờ đánh dấu đã tìm thấy đoạn đầu chưa

        let nextElem = heading.nextElementSibling;
        
        while (nextElem) {
            if (/^H[1-6]$/i.test(nextElem.tagName)) {
                break;
            }

            if (nextElem.tagName.toLowerCase() === 'p') {
                const rawSub = getCleanTextContent(nextElem);
                if (rawSub) {
                    let subText = "";
                    const dotIndex = rawSub.indexOf('.');
                    if (dotIndex !== -1 && dotIndex < 100) {
                        subText = rawSub.substring(0, dotIndex + 1);
                    } else {
                        subText = rawSub.substring(0, 80) + (rawSub.length > 80 ? "..." : "");
                    }
                    
                    let paraId = null;
                    const segment = nextElem.querySelector('.segment');
                    if (segment && segment.id) {
                        paraId = segment.id;
                    } else if (nextElem.id) {
                        paraId = nextElem.id;
                    }

                    // [UPDATED LOGIC] Phân loại: Mô tả hay Item con?
                    if (!isFirstContentFound) {
                        // Đây là đoạn văn đầu tiên -> Làm Description cho Heading
                        description = subText; // Lấy text trơn, không prefix
                        isFirstContentFound = true;
                    } else {
                        // Đây là các đoạn văn tiếp theo -> Làm Item con trong danh sách
                        let paraNum = "";
                        if (paraId) {
                            paraNum = extractParagraphNumber(paraId);
                            if (nextElem.querySelector('.evam') || nextElem.closest('.evam')) {
                                paraNum = "";
                            }
                        }
                        subTexts.push({ id: paraId, text: subText, prefix: paraNum });
                    }
                }
            }
            nextElem = nextElem.nextElementSibling;
        }

        return {
            id: heading.id,
            text: getCleanTextContent(heading),
            levelClass: `headings-${heading.tagName.toLowerCase()}`, 
            prefix: prefix,
            description: description, // [NEW] Trả về description
            subTexts: subTexts 
        };
    },

    _parseParagraph(segment) {
        let paraNum = extractParagraphNumber(segment.id);
        if (segment.querySelector('.evam') || segment.closest('.evam')) {
            paraNum = "";
        }

        let text = "Paragraph";
        const rawText = getCleanTextContent(segment);
        if (rawText) text = rawText;

        if (text.length > 60) {
            text = text.substring(0, 60) + "...";
        }

        return {
            id: segment.id,
            text: text,
            levelClass: "headings-h3", 
            prefix: paraNum
        };
    }
};