// Path: web/assets/modules/ui/components/familiarity_bar.js
import { ReadManager } from "ui/managers/read_manager.js";

export const FamiliarityBar = {
    generateHtml(uid, isHeader = true) {
        const currentLevel = ReadManager.getFamiliarity(uid);
        
        // Tạo các nút 0 đến 5
        let buttonsHtml = '';
        // Button 0 (Reset/Unfamiliar)
        buttonsHtml += `<button class="fam-btn fam-btn-0 ${currentLevel === 0 ? 'active' : ''}" data-level="0" title="Not familiar"></button>`;
        
        for (let i = 1; i <= 5; i++) {
            buttonsHtml += `<button class="fam-btn fam-btn-${i} ${currentLevel === i ? 'active' : ''}" data-level="${i}" title="Level ${i}"></button>`;
        }

        return `
            <div class="familiarity-bar-container" data-uid="${uid}">
                ${buttonsHtml}
            </div>
        `;
    },

    bindEvents() {
        const containers = document.querySelectorAll('.familiarity-bar-container');
        containers.forEach(container => {
            const uid = container.getAttribute('data-uid');
            const buttons = container.querySelectorAll('.fam-btn');
            
            buttons.forEach(btn => {
                // Xoá sự kiện cũ để tránh chạy nhiều lần
                btn.onclick = null;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const level = parseInt(btn.getAttribute('data-level'), 10);
                    
                    // Lấy Acronym, Title và Original Title từ header để lưu vào history
                    const acronymEl = document.getElementById("nav-main-title");
                    const titleEl = document.getElementById("nav-sub-title");
                    const originalEl = document.getElementById("nav-original-title");
                    
                    const acronym = acronymEl ? acronymEl.textContent.trim() : uid.toUpperCase();
                    const title = titleEl ? titleEl.textContent.trim() : "";
                    const original = originalEl ? originalEl.textContent.trim() : "";

                    ReadManager.setFamiliarity(uid, level, acronym, title, false, original);
                    this.updateUIState(uid, level);
                };
            });
        });
    },

    updateUIState(uid, level) {
        const containers = document.querySelectorAll(`.familiarity-bar-container[data-uid="${uid}"]`);
        containers.forEach(container => {
            const buttons = container.querySelectorAll('.fam-btn');
            buttons.forEach(btn => {
                if (parseInt(btn.getAttribute('data-level'), 10) === level) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        });
    }
};