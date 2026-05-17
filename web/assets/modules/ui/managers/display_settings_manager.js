// Path: web/assets/modules/ui/managers/display_settings_manager.js
import { AppSettings } from "core/app_settings.js";
import { getLogger } from "utils/logger.js";

const logger = getLogger("DisplaySettingsManager");

export const DisplaySettingsManager = {
    init() {
        this.btnBilingual = document.getElementById("btn-display-bilingual");
        this.btnRoot = document.getElementById("btn-display-root");
        this.btnTrans = document.getElementById("btn-display-trans");

        if (!this.btnBilingual) return;

        this._bindEvents();
        this._updateUI(AppSettings.getViewMode());
        
        logger.info("Init", "DisplaySettingsManager initialized");
    },

    _bindEvents() {
        this.btnBilingual.onclick = () => this._handleModeChange('bilingual');
        this.btnRoot.onclick = () => this._handleModeChange('root-only');
        this.btnTrans.onclick = () => this._handleModeChange('trans-only');

        // Listen for external changes (e.g. state sync)
        window.addEventListener("display-settings-changed", (e) => {
             this._updateUI(AppSettings.getViewMode());
        });
    },

    _handleModeChange(mode) {
        AppSettings.setViewMode(mode);
        this._updateUI(mode);
    },

    _updateUI(mode) {
        [this.btnBilingual, this.btnRoot, this.btnTrans].forEach(btn => {
            if (btn) btn.classList.remove("active");
        });

        if (mode === 'bilingual' && this.btnBilingual) this.btnBilingual.classList.add("active");
        if (mode === 'root-only' && this.btnRoot) this.btnRoot.classList.add("active");
        if (mode === 'trans-only' && this.btnTrans) this.btnTrans.classList.add("active");
    }
};
