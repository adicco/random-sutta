// Path: web/assets/modules/ui/managers/margin_manager.js
export const MarginManager = {
    // Config
    MIN_MARGIN: 0,
    MAX_MARGIN: 200,
    STEP: 10,
    DEFAULT_MARGIN: 40,
    STORAGE_KEY: "sutta_reader_margin",

    init() {
        const btnDecrease = document.getElementById("btn-margin-decrease");
        const btnIncrease = document.getElementById("btn-margin-increase");
        const label = document.getElementById("margin-label");

        // 1. Load saved state
        const saved = localStorage.getItem(this.STORAGE_KEY);
        let currentMargin = saved !== null ? parseInt(saved) : this.DEFAULT_MARGIN;
        
        // Apply initial
        this.applyMargin(currentMargin);

        // 2. Events
        if (btnDecrease) {
            btnDecrease.addEventListener("click", (e) => {
                e.stopPropagation();
                if (currentMargin > this.MIN_MARGIN) {
                    currentMargin = Math.max(this.MIN_MARGIN, currentMargin - this.STEP);
                    this.applyMargin(currentMargin);
                }
            });
        }

        if (btnIncrease) {
            btnIncrease.addEventListener("click", (e) => {
                e.stopPropagation();
                if (currentMargin < this.MAX_MARGIN) {
                    currentMargin = Math.min(this.MAX_MARGIN, currentMargin + this.STEP);
                    this.applyMargin(currentMargin);
                }
            });
        }

        // Reset on label click
        if (label) {
            label.addEventListener("click", (e) => {
                e.stopPropagation();
                currentMargin = this.DEFAULT_MARGIN;
                this.applyMargin(currentMargin);
            });
            label.style.cursor = "pointer";
            label.title = "Reset Margin";
        }
    },

    applyMargin(margin) {
        // Update CSS Variable
        document.documentElement.style.setProperty('--reader-margin', `${margin}px`);
        
        // Update Label
        const label = document.getElementById("margin-label");
        if (label) {
            label.textContent = `${margin}px`;
        }

        // Save
        localStorage.setItem(this.STORAGE_KEY, margin);
    }
};