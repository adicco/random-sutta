// Path: web/assets/modules/ui/managers/font_size_manager.js
export const FontSizeManager = {
    // Config
    MIN_SCALE: 0.8,
    MAX_SCALE: 2.0, // Tăng tối đa 200%
    STEP: 0.05,
    DEFAULT_SCALE: 1.0,
    STORAGE_KEY: "sutta_font_scale",

    init() {
        const btnDecrease = document.getElementById("btn-font-decrease");
        const btnIncrease = document.getElementById("btn-font-increase");
        const label = document.getElementById("font-size-label");

        // 1. Load saved state
        const saved = localStorage.getItem(this.STORAGE_KEY);
        let currentScale = saved ? parseFloat(saved) : this.DEFAULT_SCALE;
        
        // Apply initial
        this.applyScale(currentScale);

        // 2. Events
        if (btnDecrease) {
            btnDecrease.addEventListener("click", (e) => {
                e.stopPropagation();
                if (currentScale > this.MIN_SCALE) {
                    currentScale = Math.max(this.MIN_SCALE, currentScale - this.STEP);
                    this.applyScale(currentScale);
                }
            });
        }

        if (btnIncrease) {
            btnIncrease.addEventListener("click", (e) => {
                e.stopPropagation();
                if (currentScale < this.MAX_SCALE) {
                    currentScale = Math.min(this.MAX_SCALE, currentScale + this.STEP);
                    this.applyScale(currentScale);
                }
            });
        }

        // Reset on label click
        if (label) {
            label.addEventListener("click", (e) => {
                e.stopPropagation();
                currentScale = this.DEFAULT_SCALE;
                this.applyScale(currentScale);
            });
            label.style.cursor = "pointer";
            label.title = "Reset Font Size";
        }
    },

    applyScale(scale) {
        // Làm tròn để tránh số thập phân dài (ví dụ: 1.1000002)
        const cleanScale = Math.round(scale * 10) / 10;
        
        // Update CSS Variable
        document.documentElement.style.setProperty('--text-scale', cleanScale);
        
        // Save
        localStorage.setItem(this.STORAGE_KEY, cleanScale);
    }
};