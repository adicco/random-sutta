// Path: web/assets/modules/ui/components/filters/filter_state.js
// [FIXED] Đường dẫn import lùi 3 cấp: filters -> components -> ui -> modules -> data
import { PRIMARY_BOOKS } from 'data/constants.js';

const STORAGE_KEY = "active_book_filters";
const filterSet = new Set();

export const FilterState = {
    initFromUrl(bParam) {
        filterSet.clear();
        let initialBooks = new Set();

        if (bParam) {
            const booksFromUrl = bParam.toLowerCase().split(",").map((s) => s.trim());
            booksFromUrl.forEach((b) => initialBooks.add(b));
            // Save to storage when URL param is used to keep it persistent
            this._saveToStorage();
        } else {
            // Load from localStorage if available
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const books = JSON.parse(saved);
                    if (Array.isArray(books) && books.length > 0) {
                        books.forEach(b => initialBooks.add(b));
                    } else {
                        PRIMARY_BOOKS.forEach((b) => initialBooks.add(b));
                    }
                } catch (e) {
                    PRIMARY_BOOKS.forEach((b) => initialBooks.add(b));
                }
            } else {
                // Mặc định chọn hết Primary
                PRIMARY_BOOKS.forEach((b) => initialBooks.add(b));
            }
        }
        
        initialBooks.forEach(b => filterSet.add(b));
    },

    has(bookId) {
        return filterSet.has(bookId);
    },

    add(bookId) {
        filterSet.add(bookId);
        this._saveToStorage();
    },

    delete(bookId) {
        filterSet.delete(bookId);
        this._saveToStorage();
    },

    // Chế độ Solo: Chỉ giữ 1 cuốn
    setSolo(bookId) {
        filterSet.clear();
        filterSet.add(bookId);
        this._saveToStorage();
    },

    getActiveList() {
        return Array.from(filterSet);
    },

    reset() {
        filterSet.clear();
        PRIMARY_BOOKS.forEach((b) => filterSet.add(b));
        this._saveToStorage();
    },

    generateParam() {
        const active = Array.from(filterSet);
        const defaults = PRIMARY_BOOKS;

        // Nếu tắt hết -> Trả về null (Total Random)
        if (active.length === 0) return null;

        if (active.length !== defaults.length) {
            return active.join(",");
        }

        const activeSetCheck = new Set(active);
        for (let book of defaults) {
            if (!activeSetCheck.has(book)) return active.join(",");
        }
        
        return null;
    },

    _saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(filterSet)));
    }
};