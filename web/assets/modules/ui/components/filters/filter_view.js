// Path: web/assets/modules/ui/components/filters/filter_view.js
// [FIXED] Đường dẫn import lùi 3 cấp
import { PRIMARY_BOOKS, SECONDARY_BOOKS } from 'data/constants.js';

export const FilterView = {
    render(containerIds, state, callbacks) {
        const primaryDiv = document.getElementById(containerIds.primary);
        const secondaryDiv = document.getElementById(containerIds.secondary);
        const moreBtn = document.getElementById(containerIds.moreBtn);

        if (!primaryDiv || !secondaryDiv) return;

        primaryDiv.innerHTML = "";
        secondaryDiv.innerHTML = "";

        // 1. Phân chia Primary thành 2 hàng (Nikayas & Others)
        const rowNikayas = document.createElement("div");
        rowNikayas.className = "filter-row";
        
        const rowOthers = document.createElement("div");
        rowOthers.className = "filter-row";

        const mainNikayas = ["dn", "mn", "sn", "an"];

        PRIMARY_BOOKS.forEach((book) => {
            const isActive = state.has(book);
            const targetRow = mainNikayas.includes(book) ? rowNikayas : rowOthers;
            this._createButton(book, targetRow, isActive, callbacks);
        });

        primaryDiv.appendChild(rowNikayas);
        primaryDiv.appendChild(rowOthers);

        // 2. Secondary Books
        let hasSecondaryActive = false;
        SECONDARY_BOOKS.forEach((book) => {
            const isActive = state.has(book);
            if (isActive) hasSecondaryActive = true;
            this._createButton(book, secondaryDiv, isActive, callbacks);
        });

        // 3. More Button Logic
        if (hasSecondaryActive) {
            secondaryDiv.classList.remove("hidden");
            moreBtn.textContent = "Hide";
        } else {
            secondaryDiv.classList.add("hidden");
            moreBtn.textContent = "Others";
        }

        moreBtn.onclick = () => {
            secondaryDiv.classList.toggle("hidden");
            moreBtn.textContent = secondaryDiv.classList.contains("hidden") ? "Others" : "Hide";
            
            // [NEW] Clear custom height so it auto-resizes to fit new content
            const popup = document.getElementById("filter-popup");
            if (popup) {
                popup.style.removeProperty('--popup-filter-height');
                // Remove from local storage as well to reset to auto height
                localStorage.removeItem('filter_popup_height');
            }
        };
    },

    _createButton(bookId, container, isActive, callbacks) {
        const btn = document.createElement("button");
        btn.className = "filter-btn";
        if (isActive) btn.classList.add("active");
        
        btn.style.touchAction = "pan-y"; 
        btn.dataset.bookId = bookId;

        // Label Logic
        if (["dn", "mn", "sn", "an"].includes(bookId)) {
            btn.textContent = bookId.toUpperCase();
        } else {
            btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
        }

        // Gắn sự kiện (Gestures)
        if (callbacks.attachGestures) {
            callbacks.attachGestures(btn, bookId);
        }

        container.appendChild(btn);
    },

    updateBtnState(bookId, isActive) {
        const btn = document.querySelector(`.filter-btn[data-book-id="${bookId}"]`);
        if (btn) {
            if (isActive) btn.classList.add("active");
            else btn.classList.remove("active");
        }
    },

    updateAllStates(state) {
        const allBtns = document.querySelectorAll('.filter-btn');
        allBtns.forEach(btn => {
            const bid = btn.dataset.bookId;
            if (state.has(bid)) btn.classList.add("active");
            else btn.classList.remove("active");
        });
    }
};