// Path: web/assets/modules/ui/managers/theme_manager.js
import { AppConfig } from 'core/app_config.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("ThemeManager");

export const ThemeManager = {
    CONFIG: {
        STORAGE_KEY_THEME: "sutta_theme",
    },

    init() {
        const btn = document.getElementById("btn-theme-toggle");
        const iconMoon = btn?.querySelector(".icon-moon");
        const iconSun = btn?.querySelector(".icon-sun");
        
        const sepiaPanel = document.getElementById("sepia-control-panel");
        const sepiaSlider = document.getElementById("sepia-slider");
        const sepiaIndicator = document.getElementById("btn-sepia-indicator");

        // [NEW] Inject Config vào CSS Root Variables
        // Giúp CSS calc() sử dụng được các thông số từ app_config.js
        document.documentElement.style.setProperty('--sepia-hue-coeff', AppConfig.SEPIA.HUE_COEFF);
        document.documentElement.style.setProperty('--sepia-saturate', AppConfig.SEPIA.SATURATE);

        // 1. Load Initial State
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const storedTheme = localStorage.getItem(this.CONFIG.STORAGE_KEY_THEME);
        
        let currentTheme = storedTheme || (systemPrefersDark ? "dark" : "light");

        // --- Helpers ---

        const getSepiaStorageKey = (theme) => `${AppConfig.SEPIA.STORAGE_KEY_PREFIX}${theme}`;
        
        // [NEW] Dynamic Panel Toggling & Positioning
        const toggleSepiaPanel = () => {
            if (!sepiaPanel) return;

            const isHidden = sepiaPanel.classList.contains("hidden");

            if (isHidden) {
                // Show Panel
                sepiaPanel.classList.remove("hidden");
                if (sepiaIndicator) sepiaIndicator.classList.add("panel-open");

                // Calculate Position based on viewport
                if (sepiaIndicator) {
                    requestAnimationFrame(() => {
                        const rect = sepiaIndicator.getBoundingClientRect();
                        const panelWidth = sepiaPanel.offsetWidth;
                        const panelHeight = sepiaPanel.offsetHeight;
                        
                        // Center align horizontally relative to indicator
                        const centeredLeft = rect.left + (rect.width / 2) - (panelWidth / 2);
                        
                        // Position above the indicator with some gap
                        const topPosition = rect.top - panelHeight - 10;
                        
                        sepiaPanel.style.left = `${centeredLeft}px`;
                        sepiaPanel.style.top = `${topPosition}px`;
                    });
                }
            } else {
                // Hide Panel
                sepiaPanel.classList.add("hidden");
                if (sepiaIndicator) sepiaIndicator.classList.remove("panel-open");
            }
        };

        const sliderToCss = (sliderValue, theme) => {
            const maxCss = theme === 'dark' 
                ? AppConfig.SEPIA.MAX_CSS_DARK 
                : AppConfig.SEPIA.MAX_CSS_LIGHT;
            return (sliderValue / 100) * maxCss;
        };

        const updateSepiaVisuals = (sliderValue, theme) => {
            const cssValue = sliderToCss(sliderValue, theme);
            
            // Truyền giá trị thô (unitless) để CSS tự tính toán
            document.documentElement.style.setProperty('--sepia-val', cssValue);
            
            if (sepiaSlider && sepiaSlider.value != sliderValue) {
                sepiaSlider.value = sliderValue;
            }

            // [NEW] Update Indicator Text
            if (sepiaIndicator) {
                sepiaIndicator.textContent = sliderValue; // Just the number
                // Optional: visual clue when active (value > 0) - Kept for logic but CSS overrides color
                if (sliderValue > 0) sepiaIndicator.classList.add("has-value");
                else sepiaIndicator.classList.remove("has-value");
            }
        };

        const applyTheme = (theme) => {
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem(this.CONFIG.STORAGE_KEY_THEME, theme);
            currentTheme = theme;
            
            if (theme === "dark") {
                iconMoon?.classList.add("hidden");
                iconSun?.classList.remove("hidden");
            } else {
                iconMoon?.classList.remove("hidden");
                iconSun?.classList.add("hidden");
            }

            const savedSepia = localStorage.getItem(getSepiaStorageKey(theme)) || 0;
            updateSepiaVisuals(savedSepia, theme);
        };

        // --- Init Run ---
        applyTheme(currentTheme);

        // --- Event Listeners ---
        // [NEW] Indicator Click
        if (sepiaIndicator) {
            sepiaIndicator.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent propagation
                toggleSepiaPanel();
            });
        }

        if (btn) {
            btn.addEventListener("click", () => {
                const newTheme = currentTheme === "light" ? "dark" : "light";
                applyTheme(newTheme);
                
                // Close sepia panel if open to keep UI clean
                if (sepiaPanel && !sepiaPanel.classList.contains("hidden")) {
                    toggleSepiaPanel(); 
                }
            });
        }

        if (sepiaSlider) {
            sepiaSlider.addEventListener("input", (e) => {
                const val = e.target.value;
                updateSepiaVisuals(val, currentTheme);
                localStorage.setItem(getSepiaStorageKey(currentTheme), val);
            });

            document.addEventListener("click", (e) => {
                // [UPDATED] Ignore clicks on indicator too
                if (sepiaPanel && !sepiaPanel.classList.contains("hidden") && 
                    !sepiaPanel.contains(e.target) && 
                    !btn.contains(e.target) &&
                    (!sepiaIndicator || !sepiaIndicator.contains(e.target))) {
                    toggleSepiaPanel(); // Use helper to ensure consistent state cleanup
                }
            });
        }
    }
};