// Path: web/assets/modules/ui/components/toh/text_utils.js

/**
 * Trích xuất số đoạn từ Segment ID.
 * [UPDATED] Lấy toàn bộ giá trị sau dấu hai chấm (:).
 * Ví dụ: "mn10:3.1" -> "3.1"
 * Ví dụ: "an3.130:1.3" -> "1.3"
 */
export function extractParagraphNumber(segmentId) {
    if (!segmentId) return "";
    try {
        const colonIndex = segmentId.indexOf(':');
        
        // Nếu không có dấu :, trả về rỗng (hoặc trả về nguyên chuỗi nếu muốn)
        if (colonIndex === -1) return ""; 
        
        // Lấy toàn bộ chuỗi nằm sau dấu : đầu tiên
        return segmentId.substring(colonIndex + 1);
    } catch (e) {
        return "";
    }
}

/**
 * Lấy nội dung text sạch từ một element (ưu tiên .trans > .root > textContent).
 */
export function getCleanTextContent(element) {
    let text = element.textContent;
    const transNode = element.querySelector(".trans");
    const rootNode = element.querySelector(".root");

    if (transNode && transNode.textContent.trim()) {
        text = transNode.textContent.trim();
    } else if (rootNode && rootNode.textContent.trim()) {
        text = rootNode.textContent.trim();
    }
    
    // Xóa khoảng trắng thừa và xuống dòng
    return text.replace(/\s+/g, ' ').trim();
}