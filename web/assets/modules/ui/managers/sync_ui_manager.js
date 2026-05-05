// Path: web/assets/modules/ui/managers/sync_ui_manager.js
import { getLogger } from "utils/logger.js";
import { GoogleAuthManager } from "services/sync/google_auth_manager.js";
import { SyncOrchestrator } from "services/sync/sync_orchestrator.js";

const logger = getLogger("SyncUIManager");

export const SyncUIManager = {
    init() {
        this.els = {
            widget: document.getElementById("sync-widget"),
            btnLogin: document.getElementById("btn-sync-login"),
            btnLogout: document.getElementById("btn-sync-logout"),
            btnPush: document.getElementById("btn-sync-push"),
            btnPull: document.getElementById("btn-sync-pull"),
            manualControls: document.getElementById("sync-manual-controls"),
            clientIdInput: document.getElementById("sync-client-id")
        };

        if (!this.els.btnLogin) return;

        this._setupEventListeners();
        this._loadSettings();
        this._updateUI();
        
        // Initialize Orchestrator
        SyncOrchestrator.init();

        // Global Sync Listeners for Animation
        window.addEventListener("sync-start", () => this._setVisualState("syncing"));
        window.addEventListener("sync-end", () => this._setVisualState("authed"));
        window.addEventListener("sync-error", () => this._setVisualState("sync-error"));
    },

    _setupEventListeners() {
        this.els.btnLogin.onclick = (e) => {
            e.stopPropagation();
            const clientId = this.els.clientIdInput.value.trim();
            if (!clientId || this.els.clientIdInput.classList.contains("hidden")) {
                this.els.clientIdInput.classList.remove("hidden");
                this.els.clientIdInput.focus();
                return;
            }
            GoogleAuthManager.setClientId(clientId);
            GoogleAuthManager.login();
        };

        this.els.btnLogout.onclick = (e) => {
            e.stopPropagation();
            if (confirm("Logout from Google Sync?")) {
                GoogleAuthManager.logout();
                this._updateUI();
            }
        };

        this.els.btnPush.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Overwrite Cloud data with Local data?")) {
                window.dispatchEvent(new CustomEvent("sync-start"));
                try {
                    await SyncOrchestrator.forcePush();
                    window.dispatchEvent(new CustomEvent("sync-end"));
                } catch (e) {
                    window.dispatchEvent(new CustomEvent("sync-error"));
                }
            }
        };

        this.els.btnPull.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Overwrite Local data with Cloud data? This will refresh your bookmarks and settings.")) {
                window.dispatchEvent(new CustomEvent("sync-start"));
                try {
                    await SyncOrchestrator.forcePull();
                    window.dispatchEvent(new CustomEvent("sync-end"));
                } catch (e) {
                    window.dispatchEvent(new CustomEvent("sync-error"));
                }
            }
        };

        this.els.clientIdInput.onchange = (e) => {
            GoogleAuthManager.setClientId(e.target.value.trim());
        };

        this.els.clientIdInput.onclick = (e) => e.stopPropagation();

        // Listen for Auth Events
        window.addEventListener("google-auth-success", () => this._updateUI());
        window.addEventListener("google-auth-logout", () => this._updateUI());
    },

    _loadSettings() {
        const savedId = GoogleAuthManager.loadClientId();
        if (savedId) {
            this.els.clientIdInput.value = savedId;
        }
    },

    _updateUI() {
        const isAuthed = GoogleAuthManager.isAuthenticated();
        
        if (isAuthed) {
            this.els.btnLogin.classList.add("hidden");
            this.els.manualControls.classList.remove("hidden");
            this.els.clientIdInput.classList.add("hidden");
            this._setVisualState("authed");
        } else {
            this.els.btnLogin.classList.remove("hidden");
            this.els.manualControls.classList.add("hidden");
            this._setVisualState("off");
        }
    },

    _setVisualState(state) {
        if (!this.els.widget) return;
        this.els.widget.classList.remove("off", "authed", "syncing", "sync-error");
        this.els.widget.classList.add(state);
    }
};