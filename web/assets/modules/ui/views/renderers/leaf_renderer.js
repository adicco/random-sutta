// Path: web/assets/modules/ui/views/renderers/leaf_renderer.js
import { ContentCompiler } from "data/content_compiler.js";

function createContextFooter(currentUid, metaEntry, contextMeta) {
    if (!metaEntry || metaEntry.type !== 'subleaf' || !metaEntry.parent_uid) return "";

    const parentId = metaEntry.parent_uid;
    const parentMeta = contextMeta[parentId] || {};
    
    const acronym = parentMeta.acronym || parentId.toUpperCase();
    const title = parentMeta.translated_title || parentMeta.original_title || "";
    // Kiểm tra xem title có trùng acronym không (tránh in lặp)
    const hasDistinctTitle = title && title.toLowerCase() !== acronym.toLowerCase();
    const targetId = metaEntry.extract_id || currentUid;
    const action = `window.loadSutta('${parentId}#${targetId}', true, 0, { transition: false })`;

    return `
        <div class="sutta-context-footer">
            <span class="ctx-label">See also</span>
            <button onclick="${action}" class="ctx-link">
                <span class="ctx-acronym">${acronym}</span>
                ${hasDistinctTitle ? `<span class="ctx-title">${title}</span>` : ''}
            </button>
        </div>
    `;
}

// [UPDATED] Helper: Xử lý hậu kỳ HTML (Global Check Strategy)
function postProcessHtml(htmlString) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlString;

    const segments = wrapper.querySelectorAll('.segment');

    // 1. GLOBAL CHECK: Quét xem trang này có chút tiếng Anh nào không?
    // Chỉ cần tìm thấy MỘT thẻ .trans có nội dung -> Coi như trang này ĐÃ DỊCH (Translation Exists)
    let isTranslatedPage = false;
    for (const seg of segments) {
        const trans = seg.querySelector('.trans');
        if (trans && trans.textContent.trim().length > 0) {
            isTranslatedPage = true;
            break; // Tìm thấy rồi thì dừng ngay cho nhanh
        }
    }

    // 2. Process từng segment dựa trên kết quả Global Check
    segments.forEach(seg => {
        const root = seg.querySelector('.root');
        const trans = seg.querySelector('.trans');

        // Logic A: Promote Root (Chỉ khi TOÀN BỘ trang không có dịch)
        if (!isTranslatedPage && root) {
            root.classList.add('promoted');
        }

        // Logic B: Clean Redundant Headings
        if (root && trans) {
            const parentHeading = seg.closest('h1, h2, h3, h4, h5, h6, .sutta-title');
            if (parentHeading) {
                const rootText = root.textContent.trim();
                const transText = trans.textContent.trim();
                if (rootText === transText && rootText.length > 0) {
                    root.classList.add('hidden');
                }
            }
        }

        // Logic C: Tag segment itself
        if (!root || root.textContent.trim().length === 0) seg.classList.add('no-root');
        if (!trans || trans.textContent.trim().length === 0) seg.classList.add('no-trans');
    });

    // 3. Tag parent blocks (p, h1-h6, etc.) to hide them if they become empty in single language modes
    const blocks = wrapper.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, .sutta-title, .mirror-row');
    blocks.forEach(block => {
        const hasRoot = Array.from(block.querySelectorAll('.root')).some(el => el.textContent.trim().length > 0);
        const hasTrans = Array.from(block.querySelectorAll('.trans')).some(el => el.textContent.trim().length > 0);
        
        if (!hasRoot) block.classList.add('no-root-content');
        if (!hasTrans) block.classList.add('no-trans-content');
    });

    // 4. [NEW] Nếu là trang đơn ngữ (không có dịch), gắn class vào article để CSS trigger paragraph flow
    const article = wrapper.querySelector('article');
    if (article && !isTranslatedPage) {
        article.classList.add('single-language');
    }

    return wrapper.innerHTML;
}

function getDisplayInfo(uid, metaEntry) {
    let main = uid.toUpperCase();
    let sub = "";
    let original = "";
    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) main = `${match[1].toUpperCase()} ${match[2]}`;

    if (metaEntry) {
        main = metaEntry.acronym || main;
        sub = metaEntry.translated_title || "";
        original = metaEntry.original_title || "";
        
        // If sub is empty, fallback to original as sub title if desired
        if (!sub && original) sub = original;
    }
    return { main, sub, original };
}

export const LeafRenderer = {
    render(data, options = { showRoot: true, showTrans: true }) {
        // 1. Compile nội dung thô
        let htmlContent = ContentCompiler.compile(data.content, data.uid, options);

        // 2. [UPDATED] Xử lý hậu kỳ (Clean Heading & Promote Pali)
        htmlContent = postProcessHtml(htmlContent);

        // 3. Tạo Footer điều hướng ngữ cảnh
        const footerHtml = createContextFooter(data.uid, data.meta, data.contextMeta);
        if (footerHtml) {
            htmlContent = htmlContent + footerHtml;
        }

        const displayInfo = getDisplayInfo(data.uid, data.meta);
        return {
            html: htmlContent,
            displayInfo: displayInfo
        };
    }
};