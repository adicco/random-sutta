// Path: web/assets/modules/toolbar/toolbar_manager.js
import { SearchEngine } from "./search_engine.js";

export const ToolbarManager = {
    init: function() {
        this.triggerBtn = document.getElementById("magic-toolbar-trigger");
        this.toolbar = document.getElementById("global-toolbar");
        this.searchInput = document.getElementById("toolbar-search-input");
        this.searchInfo = document.getElementById("toolbar-search-info");
        this.btnPrev = document.getElementById("toolbar-search-prev");
        this.btnNext = document.getElementById("toolbar-search-next");
        this.btnClose = document.getElementById("toolbar-close-btn");
        
        // Search engine acts on the sutta container
        this.rootContainer = document.getElementById("sutta-container");
        this.searchEngine = new SearchEngine(this.rootContainer);
        
        this.isOpen = false;
        this.searchDebounce = null;

        this._bindEvents();
    },

    _bindEvents: function() {
        // Toggle toolbar from bottom-left corner
        if (this.triggerBtn) {
            this.triggerBtn.addEventListener("click", () => this.toggle());
        }

        // Close button
        if (this.btnClose) {
            this.btnClose.addEventListener("click", () => this.close());
        }

        // Global keyboard shortcut: Ctrl+F or Cmd+F
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault(); // Stop browser search
                this.open();
                this.searchInput.focus();
            }
        });

        // Search Input Events
        if (this.searchInput) {
            this.searchInput.addEventListener("input", (e) => {
                if (this.searchDebounce) clearTimeout(this.searchDebounce);
                this.searchDebounce = setTimeout(() => {
                    this._performSearch(e.target.value);
                }, 300);
            });

            this.searchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this._navPrev();
                    } else {
                        this._navNext();
                    }
                } else if (e.key === "Escape") {
                    this.close();
                }
            });
        }

        // Nav Buttons
        if (this.btnNext) {
            this.btnNext.addEventListener("click", () => this._navNext());
        }
        
        if (this.btnPrev) {
            this.btnPrev.addEventListener("click", () => this._navPrev());
        }
    },

    toggle: function() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open: function() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.toolbar.classList.remove("hidden");
        // Update root container dynamically in case it changed or wasn't ready
        this.searchEngine.root = document.getElementById("sutta-container");
        
        // Slight delay to allow CSS transition before focusing
        setTimeout(() => {
            if (this.searchInput) this.searchInput.focus();
        }, 100);
    },

    close: function() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.toolbar.classList.add("hidden");
        
        // Clear search
        if (this.searchInput) this.searchInput.value = "";
        this.searchEngine.clear();
        this._updateUI();
    },

    _performSearch: function(term) {
        const count = this.searchEngine.search(term);
        this._updateUI(count);
    },

    _navNext: function() {
        this.searchEngine.next();
        this._updateUI();
    },

    _navPrev: function() {
        this.searchEngine.prev();
        this._updateUI();
    },

    _updateUI: function(count = null) {
        if (this.searchInfo) {
            this.searchInfo.textContent = this.searchEngine.getMatchInfo();
        }
        
        const hasMatches = this.searchEngine.matches.length > 0;
        if (this.btnNext) this.btnNext.disabled = !hasMatches;
        if (this.btnPrev) this.btnPrev.disabled = !hasMatches;
    }
};