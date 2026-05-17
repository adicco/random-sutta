// Path: web/assets/modules/core/app_settings.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("AppSettings");

export const AppSettings = {
    STORAGE_KEY: "sutta_display_settings",
    
    // Modes: 'bilingual', 'root-only', 'trans-only'
    defaults: {
        viewMode: 'bilingual'
    },

    init() {
        this.settings = this.load();
        window.AppSettings = this; // Expose globally for renderer.js
        this._updateBodyClass();
        logger.info("Init", "AppSettings initialized", this.settings);
    },

    load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? { ...this.defaults, ...JSON.parse(stored) } : { ...this.defaults };
        } catch (e) {
            return { ...this.defaults };
        }
    },

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    },

    getViewMode() {
        return this.settings.viewMode || 'bilingual';
    },

    setViewMode(mode) {
        if (!['bilingual', 'root-only', 'trans-only'].includes(mode)) return;
        this.settings.viewMode = mode;
        this.save();
        this._updateBodyClass();
        
        // Trigger re-render of current sutta if possible
        window.dispatchEvent(new CustomEvent("display-settings-changed", { detail: this.getDisplayOptions() }));
    },

    getDisplayOptions() {
        const mode = this.getViewMode();
        return {
            showRoot: mode === 'bilingual' || mode === 'root-only',
            showTrans: mode === 'bilingual' || mode === 'trans-only'
        };
    },

    _updateBodyClass() {
        const mode = this.getViewMode();
        document.body.classList.remove('view-mode-bilingual', 'view-mode-root-only', 'view-mode-trans-only');
        document.body.classList.add(`view-mode-${mode}`);
    }
};
