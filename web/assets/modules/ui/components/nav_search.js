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
      inputField.value = ""; 
      inputField.focus();
      hidePreview();
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

  function renderPreview(results, query) {
    if (!results || results.length === 0) {
      previewContainer.innerHTML = '<div class="search-preview-empty">Không tìm thấy kết quả</div>';
    } else {
      const patterns = SearchHighlight.getRegexPatterns(query);

      previewContainer.innerHTML = results.map((item, index) => {
        const uidPart = `<b>${SearchHighlight.highlight(item.uid, patterns, true)}</b>`;
        const aliasIcon = `<svg class="search-preview-alias-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        
        let metaLine = "";
        let rawContent = "";

        if (item.type === 'alias' || item.type === 'subleaf') {
          const targetTitle = SearchHighlight.highlight(item.type === 'alias' ? item.target_original_title : item.parent_original_title, patterns, true) || '';
          const targetTrans = SearchHighlight.highlight(item.type === 'alias' ? item.target_translated_title : item.parent_translated_title, patterns, true) || '';
          const separator = targetTitle && targetTrans ? ' – ' : '';
          
          metaLine = `${uidPart} ${aliasIcon} <span>${targetTitle}${separator}${targetTrans}</span>`;
          
          // Dòng 2: Ưu tiên Blurb của Đích (Alias) hoặc Cha (Subleaf)
          rawContent = (item.type === 'alias' ? item.target_blurb : item.parent_blurb) || item.blurb || "";
        } else {
          const title = SearchHighlight.highlight(item.original_title || '', patterns, true);
          const transTitle = SearchHighlight.highlight(item.translated_title || '', patterns, true);
          const separator = title && transTitle ? ' – ' : '';
          
          metaLine = `${uidPart}: <span>${title}${separator}${transTitle}</span>`;
          
          // Dòng 2: Ưu tiên Blurb
          rawContent = item.blurb || "";
        }

        // Snippet Logic:
        let displaySnippet = "";
        if (rawContent) {
            displaySnippet = SearchHighlight.highlight(SearchHighlight.smartSnippet(rawContent, patterns, 120), patterns, false);
        } else if (item.snippet) {
            // Strip FTS snippet to prevent tag leakage from DB, then re-highlight
            displaySnippet = SearchHighlight.highlight(SearchHighlight.stripHtml(item.snippet), patterns, false);
        }

        // Kiểm tra loại bỏ snippet dư thừa
        if (displaySnippet && !item.blurb && !item.target_blurb && !item.parent_blurb) {
            const snippetPure = displaySnippet.replace(/<[^>]*>/g, '').toLowerCase().replace(/\s/g, '');
            const metaLinePure = metaLine.replace(/<[^>]*>/g, '').toLowerCase().replace(/\s/g, '');
            if (metaLinePure.includes(snippetPure) || snippetPure.length < 5) {
                displaySnippet = "";
            }
        }

        return `
          <div class="search-preview-item" data-uid="${item.uid}" data-index="${index}">
            <div class="search-preview-meta">${metaLine}</div>
            <div class="search-preview-snippet">${displaySnippet}</div>
          </div>
        `;
      }).join('');
    }
    previewContainer.classList.remove("hidden");
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
    if (query.length < 2) {
      hidePreview();
      return;
    }
    
    debounceTimer = setTimeout(async () => {
       const results = await SuttaRepository.searchMetadata(query);
       if (inputField.value.trim().length >= 2) {
         renderPreview(results, query);
       }
    }, 250);
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
    const query = inputField.value.trim().toLowerCase().replace(/\s/g, "");
    if (!query) {
      cancelSearch();
      return;
    }
    // Gọi callback (thường là SuttaController.loadSutta)
    if (onSearchCallback) onSearchCallback(query);
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
