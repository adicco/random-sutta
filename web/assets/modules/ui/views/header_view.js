// Path: web/assets/modules/ui/views/header_view.js
export const HeaderView = {
    update(displayInfo, prevId, nextId, navMeta) {
        const navHeader = document.getElementById("nav-header");
        const navMainTitle = document.getElementById("nav-main-title");
        const navSubTitle = document.getElementById("nav-sub-title");
        const navOriginalTitle = document.getElementById("nav-original-title");
        const titleText = document.getElementById("nav-title-text");
        const searchContainer = document.getElementById("nav-search-container");
        const statusDiv = document.getElementById("status");

        // 1. Update Titles
        if (navMainTitle) navMainTitle.textContent = displayInfo.main;
        if (navSubTitle) navSubTitle.textContent = displayInfo.sub;
        if (navOriginalTitle) navOriginalTitle.textContent = displayInfo.original || "";

        // 2. Reset Search Mode State
        titleText?.classList.remove("hidden");
        searchContainer?.classList.add("hidden");

        // 3. Setup Navigation Buttons
        this._setupBtn("nav-prev", prevId);
        this._setupBtn("nav-next", nextId);

        // 4. Show Header
        navHeader?.classList.remove("hidden");
        statusDiv?.classList.add("hidden");
    },

    _setupBtn(btnId, targetId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        if (targetId) {
            btn.disabled = false;
            // Sử dụng window.loadSutta (đã được expose ở app.js)
            btn.onclick = () => window.loadSutta(targetId);
        } else {
            btn.disabled = true;
            btn.onclick = null;
        }
    }
};