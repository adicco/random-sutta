// Path: web/assets/modules/ui/views/renderer.js
import { LeafRenderer } from "./renderers/leaf_renderer.js";
import { BranchRenderer } from "./renderers/branch_renderer.js";
import { SearchRenderer } from "./renderers/search_renderer.js";
import { setupTableOfHeadings } from "ui/components/toh/toh_controller.js";
import { UIFactory } from "ui/common/ui_factory.js";
import { HeaderView } from "./header_view.js";
import { MagicNav } from "ui/components/magic_nav/magic_nav_controller.js";
import { FamiliarityBar } from "ui/components/familiarity_bar.js";

let tohInstance = null;

export async function renderSutta(suttaId, data, options = {}) {
    const container = document.getElementById("sutta-container");
    const famHeaderContainer = document.getElementById("familiarity-bar-header");
    const leafBlurbContainer = document.getElementById("leaf-blurb-container");
    
    // 1. Kiểm tra data null (giữ nguyên)
    if (!data) {
        container.innerHTML = UIFactory.createErrorHtml(suttaId);
        if (famHeaderContainer) famHeaderContainer.innerHTML = '';
        if (leafBlurbContainer) {
            leafBlurbContainer.innerHTML = '';
            leafBlurbContainer.classList.add("hidden");
        }
        document.getElementById("breadcrumb-container")?.classList.add("hidden");
        return false;
    }

    container.innerHTML = "";
    if (famHeaderContainer) famHeaderContainer.innerHTML = '';
    if (leafBlurbContainer) {
        leafBlurbContainer.innerHTML = '';
        leafBlurbContainer.classList.add("hidden");
    }
    let renderResult = null;
    let isLeaf = false;

    // [NEW] Trường hợp Kết quả tìm kiếm
    if (data.type === 'search_results') {
        renderResult = SearchRenderer.render(data);
        document.getElementById("breadcrumb-container")?.classList.add("hidden");
        document.getElementById("toh-wrapper")?.classList.add("hidden");
    }
    // [FIX LOGIC] Phân loại dựa trên Meta Type thay vì chỉ dựa vào sự tồn tại của Content
    // Nếu có content -> Chắc chắn render Leaf
    else if (data.content) {
        renderResult = LeafRenderer.render(data);
        isLeaf = true;
    } 
    // Nếu Meta nói là 'branch' hoặc 'super_book' -> Render Branch
    else if (data.meta && (data.meta.type === 'branch' || data.meta.type === 'super_book' || data.meta.type === 'root')) {
        renderResult = BranchRenderer.render(data);
        document.getElementById("toh-wrapper")?.classList.add("hidden");
    } 
    // [NEW] Trường hợp còn lại: Meta là Leaf nhưng Content = null (Lỗi tải)
    else {
        console.error(`Render Error: Content missing for Leaf node '${suttaId}'`);
        container.innerHTML = `
            <div class="error-message">
                <p style="color: #d35400; font-weight: bold;">Content Unavailable (Offline)</p>
                <p>Unable to load content for <b>${suttaId.toUpperCase()}</b>.</p>
                <p>Please check your connection or try resetting the cache.</p>
            </div>`;
        return false;
    }

    // ... (Phần còn lại giữ nguyên)
    if (!window._magicNavInitialized) {
        MagicNav.init();
        window._magicNavInitialized = true;
    }

    const nav = data.nav || {};
    const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.navMeta || {});
    
    // Thêm Familiarity Bar (Chỉ hiển thị cho Leaf)
    let famBarTop = "";
    let famBarBottom = "";
    if (isLeaf) {
        famBarTop = FamiliarityBar.generateHtml(data.uid, true);
        famBarBottom = FamiliarityBar.generateHtml(data.uid, false);

        // [NEW] Render Leaf Blurb
        if (leafBlurbContainer && data.meta && data.meta.blurb) {
            leafBlurbContainer.innerHTML = `<div class="leaf-blurb">${data.meta.blurb}</div>`;
            leafBlurbContainer.classList.remove("hidden");
        }
    }
    
    if (famHeaderContainer) famHeaderContainer.innerHTML = famBarTop;
    container.innerHTML = renderResult.html + famBarBottom + bottomNavHtml;
    
    // Bind events for the newly added familiarity buttons
    if (isLeaf) {
        FamiliarityBar.bindEvents();
    }

    HeaderView.update(renderResult.displayInfo, nav.prev, nav.next, data.navMeta);

    const combinedMeta = { ...data.contextMeta, ...data.navMeta };
    if (data.meta) combinedMeta[data.uid] = data.meta;

    MagicNav.render(
        data.tree, 
        data.uid, 
        combinedMeta,
        data.superTree, 
        data.superMeta
    );

    if (isLeaf) {
        // [UPDATED] Gọi controller mới
        if (!tohInstance) tohInstance = setupTableOfHeadings();
        tohInstance.generate();
    }

    return true;
}