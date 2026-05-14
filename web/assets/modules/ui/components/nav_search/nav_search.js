// Path: web/assets/modules/ui/components/nav_search/nav_search.js
import { SuttaRepository } from "data/sutta_repository.js";
import { NavSearchRenderer } from "./nav_search_renderer.js";

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
  displayContainer.appendChild(previewContainer);

  let debounceTimer;
  let activeIndex = -1;

  function activateSearchMode() {
      textMode.classList.add("hidden");
      inputMode.classList.remove("hidden");
      document.body.classList.add("nav-search-active");
      
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
       const results = await SuttaRepository.searchMetadata(query, 1000);
       if (inputField.value.trim().length >= 2) {
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

  previewContainer.addEventListener("click", (e) => {
    const item = e.target.closest(".nav-search-item");
    if (item) {
      const uid = item.dataset.uid;
      if (onSearchCallback) onSearchCallback(uid);
      cancelSearch();
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
        const activeItem = previewContainer.querySelector(`.nav-search-item[data-index="${activeIndex}"]`);
        if (activeItem) {
          const uid = activeItem.dataset.uid;
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

  return { activateSearchMode };
}
