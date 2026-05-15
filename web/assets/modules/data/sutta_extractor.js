// Path: web/assets/modules/data/sutta_extractor.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("SuttaExtractor");

export const SuttaExtractor = {
    /**
     * Trích xuất một bài kinh con từ một tập dữ liệu lớn (Content Chunk).
     * Hỗ trợ 3 cơ chế:
     * 1. Heading Range (Mới nhất): Trích xuất từ một thẻ h2 cho tới khi gặp thẻ h2 hoặc h1 khác
     * 2. Article Tag (Mới): Dựa vào thẻ <article id="..."> trong HTML
     * 3. Prefix Match (Cũ): Dựa vào ID segment (vd: an1.1:1.1)
     */
    extract(parentContent, targetId) {
        if (!parentContent || !targetId) return null;

        const keys = Object.keys(parentContent);
        // Sắp xếp keys để đảm bảo thứ tự (quan trọng cho việc quét HTML)
        keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        // --- CHIẾN LƯỢC 1: HEADING RANGE (Dựa trên Extract ID trùng Segment Key) ---
        // Nếu targetId chính là một segment key (VD: "dn1:1.0")
        if (parentContent[targetId]) {
            const headingMatches = {};
            let isCapturing = false;
            
            for (const key of keys) {
                const segment = parentContent[key];
                const html = segment.html || "";
                
                if (key === targetId) {
                    isCapturing = true;
                } else if (isCapturing) {
                    // Nếu đang capture mà gặp <h2> hoặc <h1> khác thì dừng lại
                    if (/<h[12]/i.test(html)) {
                        break;
                    }
                }
                
                if (isCapturing) {
                    headingMatches[key] = segment;
                }
            }
            
            if (Object.keys(headingMatches).length > 0) {
                return headingMatches;
            }
        }

        // --- CHIẾN LƯỢC 2: HTML ARTICLE SCAN (Chính xác cho Range) ---
        // Regex bắt thẻ mở: <article ... id="targetId" ... >
        const startRegex = new RegExp(`<article[^>]*\\sid=['"]${this._escapeRegExp(targetId)}['"]`, 'i');
        const endRegex = /<\/article>/i;

        const articleMatches = {};
        let isCapturingArticle = false;
        let foundArticle = false;

        for (const key of keys) {
            const segment = parentContent[key];
            const html = segment.html || "";

            // 1. Kiểm tra điểm bắt đầu
            if (!isCapturingArticle && startRegex.test(html)) {
                isCapturingArticle = true;
                foundArticle = true;
            }

            // 2. Đang trong trạng thái Capture
            if (isCapturingArticle) {
                articleMatches[key] = segment;

                // 3. Kiểm tra điểm kết thúc
                if (endRegex.test(html)) {
                    isCapturingArticle = false;
                    break; 
                }
            }
        }

        if (foundArticle) {
            return articleMatches;
        }

        // --- FALLBACK: CHIẾN LƯỢC PREFIX (Nếu không tìm thấy Article Tag) ---
        const prefixMatches = {};
        let hasPrefixMatch = false;

        for (const key of keys) {
            if (key === targetId || key.startsWith(targetId + ':')) {
                prefixMatches[key] = parentContent[key];
                hasPrefixMatch = true;
            }
        }

        if (hasPrefixMatch) {
            return prefixMatches;
        }

        return null;
    },

    _escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};
