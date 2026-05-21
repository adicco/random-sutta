// Path: web/assets/modules/ui/views/renderers/leaf_renderer.js
import { ContentCompiler } from "data/content_compiler.js";

function createContextFooter(currentUid, metaEntry, contextMeta) {
    if (!metaEntry || metaEntry.type !== 'subleaf' || !metaEntry.parent_uid) return "";

    const parentId = metaEntry.parent_uid;
    const parentMeta = contextMeta[parentId] || {};
    
    const acronym = parentMeta.acronym || parentId.toUpperCase();
    const title = parentMeta.translated_title || parentMeta.original_title || "";
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

/**
 * [OPTIMIZED] Xử lý hậu kỳ trực tiếp trên DOM sau khi chèn.
 * Tránh việc innerHTML -> query -> innerHTML (double parsing).
 */
function postProcessDOM(container) {
    // Logic C: Tag parent blocks to hide them if they become empty in single language modes
    // This is more reliable in DOM than in string compilation for blocks spanning multiple segments
    const blocks = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, .sutta-title, .mirror-row');
    blocks.forEach(block => {
        const hasRoot = Array.from(block.querySelectorAll('.root')).some(el => el.textContent.trim().length > 0);
        const hasTrans = Array.from(block.querySelectorAll('.trans')).some(el => el.textContent.trim().length > 0);
        
        if (!hasRoot) block.classList.add('no-root-content');
        if (!hasTrans) block.classList.add('no-trans-content');
    });
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
        if (!sub && original) sub = original;
    }
    return { main, sub, original };
}

export const LeafRenderer = {
    render(data, options = { showRoot: true, showTrans: true }) {
        // 1. Compile nội dung thô (Logic tagging segment/article đã chuyển vào đây)
        const htmlContent = ContentCompiler.compile(data.content, data.uid, options);

        // 2. Tạo Footer
        const footerHtml = createContextFooter(data.uid, data.meta, data.contextMeta);

        const displayInfo = getDisplayInfo(data.uid, data.meta);
        return {
            html: htmlContent + footerHtml,
            displayInfo: displayInfo,
            postProcess: postProcessDOM
        };
    }
};