// Path: web/assets/modules/ui/components/nav_search.js
import { SuttaRepository } from "data/sutta_repository.js";
import { SearchHighlight } from "utils/search_highlight.js";

export function setupQuickNav(onSearchCallback) {
  const displayContainer = document.getElementById("nav-title-display");
  const textMode = document.getElementById("nav-title-text");
  const inputMode = document.getElementById("nav-search-container");
  const inputField = document.getElementById("nav-sutta-input");
  const goBtn = document.getElementById("nav-search-btn");

  if (!displayContainer || !textMode || !inputMode) return null;

  // Create preview container
  const previewContainer = document.createElement("div");
  previewContainer.id = "nav-search-preview";
  previewContainer.className = "search-preview-dropdown hidden";
  inputMode.appendChild(previewContainer);

  let debounceTimer;
  let activeIndex = -1;

  function activateSearchMode() {
      textMode.classList.add("hidden");
      inputMode.classList.remove("hidden");
      
      // Restore persisted query if within 10 minutes
      const savedQuery = localStorage.getItem("nav_search_query");
      const savedTime = localStorage.getItem("nav_search_time");
      const now = Date.now();
      
      if (savedQuery && savedTime && (now - parseInt(savedTime)) < 600000) {
          inputField.value = savedQuery;
          inputField.select();
          // Trigger search immediately to populate preview
          triggerSearch(savedQuery);
      } else {
          inputField.value = ""; 
          inputField.focus();
          hidePreview();
      }
  }

  function saveQuery(query) {
      if (query.length >= 2) {
          localStorage.setItem("nav_search_query", query);
          localStorage.setItem("nav_search_time", Date.now().toString());
      } else {
          localStorage.removeItem("nav_search_query");
          localStorage.removeItem("nav_search_time");
      }
  }

  function cancelSearch() {
    inputMode.classList.add("hidden");
    textMode.classList.remove("hidden");
    hidePreview();
  }

  function hidePreview() {
    previewContainer.classList.add("hidden");
    previewContainer.innerHTML = "";
    activeIndex = -1;
  }
  
  async function triggerSearch(query) {
       const results = await SuttaRepository.searchMetadata(query, 1000);
       if (inputField.value.trim().length >= 2) {
         renderPreview(results, query);
       }
  }

  function renderPreview(results, query) {
    if (!results || results.length === 0) {
      previewContainer.innerHTML = '<div class="search-preview-empty">Không tìm thấy kết quả</div>';
    } else {
      const patterns = SearchHighlight.getRegexPatterns(query);

      previewContainer.innerHTML = results.map((item, index) => {
        const uidHighlight = `<b>${SearchHighlight.highlight(item.uid, patterns, true)}</b>`;
        const aliasIcon = `<svg class="search-preview-alias-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; opacity:0.8; color:var(--primary-color); display:inline-block; vertical-align:middle; margin:0 4px;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        
        let translatedTitle = "";
        let originalTitle = "";
        let uidPart = "";
        let rawContent = "";

        if (item.type === 'alias' || item.type === 'subleaf') {
          const isAlias = item.type === 'alias';
          const orig = isAlias ? item.target_original_title : item.parent_original_title;
          const trans = isAlias ? item.target_translated_title : item.parent_translated_title;
          
          translatedTitle = trans ? SearchHighlight.highlight(trans, patterns, true) : SearchHighlight.highlight(orig || '', patterns, true);
          originalTitle = trans ? SearchHighlight.highlight(orig || '', patterns, true) : '';
          
          uidPart = `<span class="search-preview-uid">${uidHighlight} ${aliasIcon} ${isAlias ? 'Redirect' : ''}</span>`;
          rawContent = (isAlias ? item.target_blurb : item.parent_blurb) || item.blurb || "";
        } else {
          const orig = item.original_title || '';
          const trans = item.translated_title || '';
          
          translatedTitle = trans ? SearchHighlight.highlight(trans, patterns, true) : SearchHighlight.highlight(orig, patterns, true);
          originalTitle = trans ? SearchHighlight.highlight(orig, patterns, true) : '';
          
          uidPart = `<span class="search-preview-uid">${uidHighlight}</span>`;
          rawContent = item.blurb || "";
        }

        if (!translatedTitle) {
            translatedTitle = "Untitled";
        }

        let displaySnippet = "";
        if (rawContent) {
            displaySnippet = SearchHighlight.highlight(SearchHighlight.smartSnippet(rawContent, patterns, 120), patterns, false);
        }

        return `
          <div class="search-preview-item" data-uid="${item.uid}" data-index="${index}">
            <div class="search-preview-translated-title">${translatedTitle}</div>
            <div class="search-preview-secondary-line">
                ${originalTitle ? `<span class="search-preview-original-title">${originalTitle}</span>` : '<span></span>'}
                ${uidPart}
            </div>
            ${displaySnippet ? `<div class="search-blurb-snippet">${displaySnippet}</div>` : ''}
          </div>
        `;
      }).join('');
    }
    previewContainer.classList.remove("hidden");
    previewContainer.scrollTop = 0; // Reset scroll position when results change
    activeIndex = -1;
  }

  function updateActiveItem() {
    const items = previewContainer.querySelectorAll(".search-preview-item");
    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.classList.add("active");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active");
      }
    });
  }

  // Chuyển sang Input Mode khi click vào tiêu đề
  displayContainer.addEventListener("click", (e) => {
    if (e.target === inputField || e.target === goBtn || inputMode.contains(e.target)) {
      return;
    }
    activateSearchMode();
  });

  inputField.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = inputField.value.trim();
    saveQuery(query);
    
    if (query.length < 2) {
      hidePreview();
      return;
    }
    
    debounceTimer = setTimeout(() => triggerSearch(query), 250);
  });

  previewContainer.addEventListener("click", (e) => {
    const item = e.target.closest(".search-preview-item");
    if (item) {
      const uid = item.dataset.uid;
      inputField.value = uid;
      performSearch();
    }
  });

  const performSearch = () => {
    const query = inputField.value.trim();
    const cleanQuery = query.toLowerCase().replace(/\s/g, "");
    saveQuery(query); // Save original query on explicit search
    if (!cleanQuery) {
      cancelSearch();
      return;
    }
    // Gọi callback (thường là SuttaController.loadSutta)
    if (onSearchCallback) onSearchCallback(cleanQuery);
    cancelSearch();
  };

  goBtn.addEventListener("click", performSearch);

  inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (activeIndex >= 0) {
        const activeItem = previewContainer.querySelector(`.search-preview-item[data-index="${activeIndex}"]`);
        if (activeItem) {
          inputField.value = activeItem.dataset.uid;
        }
      }
      performSearch();
    } else if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      const items = previewContainer.querySelectorAll(".search-preview-item");
      if (items.length > 0) {
        activeIndex = (activeIndex + 1) % items.length;
        updateActiveItem();
        e.preventDefault();
      }
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      const items = previewContainer.querySelectorAll(".search-preview-item");
      if (items.length > 0) {
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateActiveItem();
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      if (!previewContainer.classList.contains("hidden")) {
        hidePreview();
      } else {
        cancelSearch();
      }
      e.stopPropagation();
    }
  });

  // Tự đóng khi mất focus
  inputField.addEventListener("blur", (e) => {
    setTimeout(() => {
      // Prevent closing if we clicked inside or are hovering over the preview container (e.g., right-click context menu)
      if (!inputMode.contains(document.activeElement) && !previewContainer.matches(':hover')) {
        cancelSearch();
      }
    }, 200);
  });

  return { activateSearchMode };
}
