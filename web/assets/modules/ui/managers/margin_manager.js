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
        const controlRow = btnDecrease?.parentElement;

        // 1. Load saved state
        const saved = localStorage.getItem(this.STORAGE_KEY);
        let currentMargin = saved !== null ? parseInt(saved) : this.DEFAULT_MARGIN;
        
        // Apply initial
        this.applyMargin(currentMargin);

        // 2. Events (Click)
        const decrease = () => {
            if (currentMargin > this.MIN_MARGIN) {
                currentMargin = Math.max(this.MIN_MARGIN, currentMargin - this.STEP);
                this.applyMargin(currentMargin);
            }
        };

        const increase = () => {
            if (currentMargin < this.MAX_MARGIN) {
                currentMargin = Math.min(this.MAX_MARGIN, currentMargin + this.STEP);
                this.applyMargin(currentMargin);
            }
        };

        if (btnDecrease) {
            btnDecrease.addEventListener("click", (e) => {
                e.stopPropagation();
                decrease();
            });
        }

        if (btnIncrease) {
            btnIncrease.addEventListener("click", (e) => {
                e.stopPropagation();
                increase();
            });
        }

        // 3. Swipe Support on the control row
        if (controlRow) {
            let startX = 0;
            const threshold = 30; // Nhạy hơn swipe màn hình chính

            controlRow.addEventListener("touchstart", (e) => {
                startX = e.touches[0].clientX;
            }, { passive: true });

            controlRow.addEventListener("touchend", (e) => {
                const deltaX = e.changedTouches[0].clientX - startX;
                if (Math.abs(deltaX) > threshold) {
                    if (deltaX > 0) {
                        // Swipe Right -> Increase Margin
                        increase();
                    } else {
                        // Swipe Left -> Decrease Margin
                        decrease();
                    }
                    // Visual feedback: briefly highlight the label
                    if (label) {
                        label.style.color = "var(--primary-color)";
                        setTimeout(() => label.style.color = "", 200);
                    }
                }
            }, { passive: true });

            // Optional: Support mouse swipe/drag for desktop testing
            controlRow.addEventListener("mousedown", (e) => {
                startX = e.clientX;
                const onMouseUp = (upEvent) => {
                    const deltaX = upEvent.clientX - startX;
                    if (Math.abs(deltaX) > threshold) {
                        if (deltaX > 0) increase();
                        else decrease();
                    }
                    document.removeEventListener("mouseup", onMouseUp);
                };
                document.addEventListener("mouseup", onMouseUp);
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