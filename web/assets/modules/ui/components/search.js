// Path: web/assets/modules/ui/components/search.js
import { SuttaRepository } from "data/sutta_repository.js";

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
      // Normalize query for highlighting: remove spaces and diacritics for a "fuzzy" match
      const cleanQuery = query.toLowerCase().replace(/\s/g, "");
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      
      const highlight = (text) => {
        if (!text) return "";
        let highlighted = text;
        
        // 1. Try matching the full normalized query (e.g. "mn1" in "MN 1")
        // We do this by finding the match in a normalized version but applying it to the original
        if (cleanQuery.length > 1) {
            const normalizedText = text.toLowerCase().replace(/\s/g, "");
            if (normalizedText.includes(cleanQuery)) {
                // This is a bit tricky to highlight exactly in the original text if there are spaces.
                // For now, let's fallback to term-based highlighting which is safer for HTML.
            }
        }

        // 2. Term-based highlighting
        queryTerms.forEach(term => {
          if (term.length < 2 && !/^\d+$/.test(term)) return; // Don't highlight single letters unless they are numbers
          const regex = new RegExp(`(${term})`, "gi");
          highlighted = highlighted.replace(regex, '<b class="match-highlight">$1</b>');
        });
        return highlighted;
      };

      previewContainer.innerHTML = results.map((item, index) => {
        let metaLine = "";
        
        // Prepare highlighted parts
        const highlightedId = highlight(item.acronym || item.uid);
        const highlightedOriginalTitle = highlight(item.original_title || '');
        const highlightedTranslatedTitle = highlight(item.translated_title || '');
        
        const idPart = `<b>${highlightedId}</b>`;
        
        if (item.type === 'alias') {
          const aliasIcon = `<svg class="search-preview-alias-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
          const hashPart = item.hash_id ? ` #${item.hash_id}` : "";
          const targetTitle = `${highlightedOriginalTitle} ${item.target_original_title && item.target_translated_title ? '–' : ''} ${highlightedTranslatedTitle}`;
          metaLine = `${aliasIcon}<span>${idPart}${hashPart}: ${targetTitle}</span>`;
        } else if (item.type === 'subleaf') {
          const title = highlightedOriginalTitle || highlight(item.parent_original_title || '');
          const transTitle = highlightedTranslatedTitle || highlight(item.parent_translated_title || '');
          const separator = title && transTitle ? ' – ' : '';
          metaLine = `<span>${idPart}: ${title}${separator}${transTitle}</span>`;
        } else {
          const title = highlightedOriginalTitle;
          const transTitle = highlightedTranslatedTitle;
          const separator = title && transTitle ? ' – ' : '';
          metaLine = `<span>${idPart}: ${title}${separator}${transTitle}</span>`;
        }

        // Snippet Logic:
        // 1. If match is in Line 1 (metaLine contains highlight tags)
        // 2. And we have a blurb
        // 3. And the FTS snippet seems redundant (just the UID or Acronym)
        // -> Then show the full blurb for context.
        
        let displaySnippet = item.snippet || '';
        const hasLine1Match = metaLine.includes('class="match-highlight"');
        const snippetIsRedundant = !displaySnippet.includes('<b>') || 
                                  (displaySnippet.replace(/<[^>]*>/g, '').length < 15);

        if (hasLine1Match && item.blurb && snippetIsRedundant) {
            displaySnippet = item.blurb;
        } else if (!displaySnippet && item.blurb) {
            displaySnippet = item.blurb;
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
      if (!inputMode.contains(document.activeElement)) {
        cancelSearch();
      }
    }, 200);
  });

  return { activateSearchMode };
}