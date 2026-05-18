// Path: web/assets/modules/ui/components/magic_nav/headings_renderer.js
import { Scroller } from 'ui/common/scroller.js';

export const HeadingsRenderer = {
    renderList(items, listElement, callbacks) {
        listElement.innerHTML = "";

        items.forEach(item => {
            if (!item.id) return; 

            const li = document.createElement("li");
            li.className = `toh-item ${item.levelClass}`;
            li.dataset.targetId = item.id; 
            
            const wrapper = document.createElement("div"); 
            wrapper.className = "toh-item-wrapper collapsed"; 
            
            // --- 1. Header Row ---
            const headerRow = document.createElement("div");
            headerRow.className = "toh-header-row";
            
            const mainTextDiv = document.createElement("div");
            mainTextDiv.className = "toh-main-text clickable";
            
            // Render Title & Description
            let titleHtml = "";
            if (item.prefix) {
                titleHtml = `<span class="toh-prefix">${item.prefix}.</span> ${item.text}`;
            } else {
                titleHtml = item.text;
            }

            if (item.description) {
                titleHtml += `<div class="toh-row-sub" style="font-weight: normal; margin-top: 2px;">${item.description}</div>`;
            }

            mainTextDiv.innerHTML = titleHtml;
            
            // Main Click Handler
            mainTextDiv.onclick = (e) => {
                e.stopPropagation();
                // [FIXED] Jump & Highlight (Temporary)
                Scroller.jumpTo(item.id); 
                Scroller.highlightElement(item.id, true); 
                if (callbacks.onItemClick) callbacks.onItemClick();
            };
            headerRow.appendChild(mainTextDiv);

            // Toggle Icon (if children exist)
            const hasChildren = item.subTexts && Array.isArray(item.subTexts) && item.subTexts.length > 0;
            if (hasChildren) {
                const toggleBtn = document.createElement("span");
                toggleBtn.className = "toh-toggle-icon";
                toggleBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    wrapper.classList.toggle("collapsed");
                };
                headerRow.appendChild(toggleBtn);
            }

            wrapper.appendChild(headerRow);

            // --- 2. Children Container ---
            if (hasChildren) {
                const childrenContainer = document.createElement("div");
                childrenContainer.className = "toh-children";
                
                item.subTexts.forEach(sub => {
                    const subDiv = document.createElement("div");
                    subDiv.className = "toh-sub-text clickable";
                    
                    if (sub.prefix) {
                        subDiv.innerHTML = `<span class="toh-prefix">${sub.prefix}</span> ${sub.text}`;
                    } else {
                        subDiv.textContent = sub.text;
                    }

                    if (sub.id) subDiv.dataset.targetId = sub.id; 

                    if (sub.id) {
                        subDiv.onclick = (e) => {
                            e.stopPropagation();
                            // [FIXED] Jump & Highlight for Sub-items (Temporary)
                            Scroller.jumpTo(sub.id);
                            Scroller.highlightElement(sub.id, true);
                            if (callbacks.onItemClick) callbacks.onItemClick();
                        };
                    } else {
                        subDiv.classList.add("disabled");
                    }
                    childrenContainer.appendChild(subDiv);
                });
                wrapper.appendChild(childrenContainer);
            } 
            else if (item.subText) {
                const subDiv = document.createElement("div");
                subDiv.className = "toh-sub-text";
                subDiv.textContent = item.subText;
                wrapper.appendChild(subDiv);
            }

            li.appendChild(wrapper);
            listElement.appendChild(li);
        });
    },

    updateActiveState(targetId) {
        const list = document.getElementById("magic-headings-list");
        if (!list) return;
        
        const actives = list.querySelectorAll(".active");
        actives.forEach(el => el.classList.remove("active"));

        if (!targetId) return;

        let targetEl = list.querySelector(`.toh-sub-text[data-target-id="${targetId}"]`);
        if (!targetEl) {
            const li = list.querySelector(`li[data-target-id="${targetId}"]`);
            if (li) targetEl = li.querySelector(".toh-header-row");
        }

        if (targetEl) {
            targetEl.classList.add("active");
            if (targetEl.classList.contains("toh-sub-text")) {
                const wrapper = targetEl.closest(".toh-item-wrapper");
                if (wrapper) wrapper.classList.remove("collapsed");
            }
            targetEl.scrollIntoView({ block: "center", behavior: "instant" });
        }
    }
};