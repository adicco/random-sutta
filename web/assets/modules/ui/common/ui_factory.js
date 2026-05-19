// Path: web/assets/modules/ui/common/ui_factory.js

const CHEVRON_PATH = "M6 15l6-6 6 6";
function getChevronSvg(rotateDeg, className = "") {
    const style = `transform: rotate(${rotateDeg}deg); transform-origin: center;`;
    return `<svg class="${className}" style="${style}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="${CHEVRON_PATH}"></path>
    </svg>`;
}

export const UIFactory = {
  createErrorHtml: function (suttaId) {
    const scLink = `https://suttacentral.net/${suttaId}`;
    return `
        <div class="error-message">
            <p style="color: var(--text-muted); font-weight: 500; font-size: 1.1rem; margin-bottom: 10px;">
                Content for <strong>${suttaId.toUpperCase()}</strong> is not available locally.
            </p>
            <p style="margin-bottom: 20px;">You can view the full text on SuttaCentral:</p>
            <a href="${scLink}" target="_blank" rel="noopener noreferrer" class="sc-link">SuttaCentral ➜</a>
        </div>`;
  },

  createNavButton: function (suttaId, direction, metaMap) {
    // Nếu ID là null/undefined -> Spacer rỗng
    if (!suttaId) return `<div class="nav-spacer"></div>`;
    
    let title = suttaId.toUpperCase();
    let subtitle = "";
    let tooltip = ""; // [NEW] Variable for tooltip

    // Tra cứu meta (được truyền từ navMeta)
    if (metaMap && metaMap[suttaId]) {
        const info = metaMap[suttaId];
        // 1. Dòng chính: Acronym (ngắn gọn)
        if (info.acronym) title = info.acronym;
        
        // 2. Dòng phụ: Tên tiếng Anh -> hoặc Tên Pali
        if (info.translated_title) subtitle = info.translated_title;
        else if (info.original_title) subtitle = info.original_title;

        // [NEW] 3. Tooltip: Ưu tiên Original Title (Pali)
        if (info.original_title) tooltip = info.original_title;
        else if (info.translated_title) tooltip = info.translated_title;
    }

    const align = direction === 'left' ? 'left' : 'right';
    const alignItems = direction === 'left' ? 'flex-start' : 'flex-end';
    const arrowIcon = direction === 'left'
        ? getChevronSvg(-90, "nav-icon-inline left")
        : getChevronSvg(90, "nav-icon-inline right");
        
    const content = direction === 'left' 
        ? `${arrowIcon}<span>${title}</span>`
        : `<span>${title}</span>${arrowIcon}`;

    // [UPDATED] Added title="${tooltip}" attribute
    return `<button onclick="window.loadSutta('${suttaId}')" class="nav-btn" style="align-items:${alignItems}; text-align:${align}" title="${tooltip}">
            <span class="nav-main-text">
                ${content}
            </span>
            <span class="nav-title">${subtitle}</span>
          </button>`;
  },

  createBottomNavHtml: function (prevId, nextId, metaMap) {
    let html = '<div class="sutta-nav">';
    // Nút Previous
    html += this.createNavButton(prevId, 'left', metaMap);
    
    // Invisible Random Bottom Trigger
    html += `
      <button
        onclick="window.triggerRandomSutta({ fromBottom: true })"
        class="nav-invisible-random"
        title="Tap here for Random Sutta"
        aria-label="Random Sutta">
      </button>
    `;    
    // Nút Next
    html += this.createNavButton(nextId, 'right', metaMap);
    
    html += "</div>";
    return html;
  }
};