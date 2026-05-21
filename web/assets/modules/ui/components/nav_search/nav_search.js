// Path: web/assets/modules/ui/components/nav_search/nav_search.js
import { SuttaRepository } from "data/sutta_repository.js";
import { NavSearchRenderer } from "./nav_search_renderer.js";
import { ZIndexManager } from "ui/common/z_index_manager.js";

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
  previewContainer.className = "nav-search-preview hidden";
  document.body.appendChild(previewContainer);

  let debounceTimer;
  let activeIndex = -1;

  function updatePreviewPosition() {
    const rect = displayContainer.getBoundingClientRect();
    previewContainer.style.top = `${rect.bottom + 5}px`;
    previewContainer.style.left = `${rect.left + rect.width / 2}px`;
  }

  function activateSearchMode() {
      textMode.classList.add("hidden");
      inputMode.classList.remove("hidden");
      document.body.classList.add("nav-search-active");

      // Bring preview to front
      ZIndexManager.bringToFront(previewContainer);
      updatePreviewPosition();
      
      // Restore persisted query if within 10 minutes
      const savedQuery = localStorage.getItem("nav_search_query");
      const savedTime = localStorage.getItem("nav_search_time");
      const now = Date.now();
      
      if (savedQuery && savedTime && (now - parseInt(savedTime)) < 600000) {
          inputField.value = savedQuery;
          inputField.select();
          // Trigger search immediately to populate preview and restore scroll
          triggerSearch(savedQuery, true);
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
          localStorage.removeItem("nav_search_scroll");
      }
  }

  function cancelSearch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    inputMode.classList.add("hidden");
    textMode.classList.remove("hidden");
    document.body.classList.remove("nav-search-active");
    hidePreview();
  }

  function hidePreview() {
    previewContainer.classList.add("hidden");
    previewContainer.innerHTML = "";
    activeIndex = -1;
  }
  
  // Track scroll position
  previewContainer.addEventListener("scroll", () => {
      localStorage.setItem("nav_search_scroll", previewContainer.scrollTop);
  }, { passive: true });

  async function triggerSearch(query, isRestore = false) {
       // [OPTIMIZED] Limit results to a sensible number for quick nav to prevent DOM bloat
       const results = await SuttaRepository.searchMetadata(query, 200);
       
       // [FIX] Guard: Only show if search mode is still active and query still matches
       const isActive = document.body.classList.contains("nav-search-active");
       const currentQuery = inputField.value.trim();
       
       if (isActive && currentQuery.length >= 2) {
         NavSearchRenderer.render(results, query, previewContainer);
         previewContainer.classList.remove("hidden");
         
         if (isRestore) {
             const savedScroll = localStorage.getItem("nav_search_scroll");
             if (savedScroll) {
                 previewContainer.scrollTop = parseInt(savedScroll, 10);
             }
         } else {
             previewContainer.scrollTop = 0; // Reset scroll position when query actually changes
             localStorage.setItem("nav_search_scroll", "0");
         }
         
         activeIndex = -1;
       }
  }

  function updateActiveItem() {
    const items = previewContainer.querySelectorAll(".nav-search-item");
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

  function extractAndSetOptimisticTitle(activeItem) {
    if (!activeItem) return;
    const uid = activeItem.dataset.uid;
    let titleText = uid;
    
    // Attempt to extract the translated title from the rendered HTML (strip highlights)
    const transEl = activeItem.querySelector(".nav-search-trans");
    if (transEl) {
       titleText = transEl.textContent.trim();
    }
    
    const navMainTitle = document.getElementById("nav-main-title");
    const navSubTitle = document.getElementById("nav-sub-title");
    
    if (navMainTitle) navMainTitle.textContent = titleText;
    if (navSubTitle) navSubTitle.textContent = uid.toUpperCase();
  }

  previewContainer.addEventListener("click", (e) => {
    const item = e.target.closest(".nav-search-item");
    if (item) {
      const uid = item.dataset.uid;
      extractAndSetOptimisticTitle(item);
      if (onSearchCallback) onSearchCallback(uid);
      cancelSearch();
    }
  });

  const performSearch = () => {
    const query = inputField.value.trim();
    if (!query) {
      cancelSearch();
      return;
    }
    
    saveQuery(query); // Save original query on explicit search
    
    // Check if it's a direct UID or needs search
    // We pass the raw query (lowercased) to the callback.
    // The controller/service will decide if it's a UID (by stripping spaces internally)
    // or if it should trigger a full search.
    const searchTarget = query.toLowerCase();

    // Try to optimistically update based on query if it looks like a UID
    const navMainTitle = document.getElementById("nav-main-title");
    const navSubTitle = document.getElementById("nav-sub-title");
    if (navMainTitle) navMainTitle.textContent = "Loading...";
    if (navSubTitle) navSubTitle.textContent = searchTarget.toUpperCase();

    // Gọi callback (thường là SuttaController.loadSutta)
    if (onSearchCallback) onSearchCallback(searchTarget);
    cancelSearch();
  };

  goBtn.addEventListener("click", performSearch);

  inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (activeIndex >= 0) {
        const activeItem = previewContainer.querySelector(`.nav-search-item[data-index="${activeIndex}"]`);
        if (activeItem) {
          const uid = activeItem.dataset.uid;
          extractAndSetOptimisticTitle(activeItem);
          if (onSearchCallback) onSearchCallback(uid);
          cancelSearch();
          return;
        }
      }
      performSearch();
    } else if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      const items = previewContainer.querySelectorAll(".nav-search-item");
      if (items.length > 0) {
        activeIndex = (activeIndex + 1) % items.length;
        updateActiveItem();
        e.preventDefault();
      }
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      const items = previewContainer.querySelectorAll(".nav-search-item");
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

  window.addEventListener("resize", () => {
    if (document.body.classList.contains("nav-search-active")) {
      updatePreviewPosition();
    }
  }, { passive: true });

  return { activateSearchMode };
}
