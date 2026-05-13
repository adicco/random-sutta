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
      // 1. Prepare highlight patterns
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      let patterns = [];
      
      queryTerms.forEach(term => {
          const isNumeric = /^[\d.]+$/.test(term);
          const acronymMatch = term.match(/^([a-z]+)([\d.]+)$/i);
          
          if (acronymMatch) {
              const alpha = acronymMatch[1].split('').join('[\\s.]*');
              const digits = acronymMatch[2].split('').map(d => d === '.' ? '\\.' : d).join('[\\s.]*');
              patterns.push(new RegExp(`(?![^<]*>)(${alpha}[\\s.]*${digits})`, "gi"));
          } else if (isNumeric && term.length >= 1) {
              const digits = term.split('').map(d => d === '.' ? '\\.' : d).join('[\\s.]*');
              patterns.push(new RegExp(`(?![^<]*>)(${digits})`, "gi"));
          } else if (term.length > 1) {
              patterns.push(new RegExp(`(?![^<]*>)(${term.replace(/\./g, "\\.")})`, "gi"));
          }
      });
      patterns.sort((a, b) => b.source.length - a.source.length);

      const highlight = (text) => {
        if (!text) return "";
        let highlighted = text;
        patterns.forEach(regex => {
          highlighted = highlighted.replace(regex, '<b class="match-highlight">$1</b>');
        });
        return highlighted;
      };

      previewContainer.innerHTML = results.map((item, index) => {
        const uidPart = `<b>${highlight(item.uid)}</b>`;
        const aliasIcon = `<svg class="search-preview-alias-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        
        let metaLine = "";
        let displaySnippet = "";

        if (item.type === 'alias' || item.type === 'subleaf') {
          const targetTitle = highlight(item.type === 'alias' ? item.target_original_title : item.parent_original_title) || '';
          const targetTrans = highlight(item.type === 'alias' ? item.target_translated_title : item.parent_translated_title) || '';
          const separator = targetTitle && targetTrans ? ' – ' : '';
          
          metaLine = `${uidPart} ${aliasIcon} <span>${targetTitle}${separator}${targetTrans}</span>`;
          
          // Dòng 2: Ưu tiên Blurb của Đích (Alias) hoặc Cha (Subleaf) tuyệt đối
          displaySnippet = (item.type === 'alias' ? item.target_blurb : item.parent_blurb) || item.blurb || item.snippet || "";
        } else {
          const title = highlight(item.original_title || '');
          const transTitle = highlight(item.translated_title || '');
          const separator = title && transTitle ? ' – ' : '';
          
          metaLine = `${uidPart}: <span>${title}${separator}${transTitle}</span>`;
          
          // Dòng 2: Ưu tiên Blurb tuyệt đối
          displaySnippet = item.blurb || item.snippet || "";
        }

        // Kiểm tra loại bỏ snippet dư thừa (Nếu chỉ lặp lại nội dung đã có ở dòng 1 và không phải blurb thật)
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
      if (!inputMode.contains(document.activeElement)) {
        cancelSearch();
      }
    }, 200);
  });

  return { activateSearchMode };
}
