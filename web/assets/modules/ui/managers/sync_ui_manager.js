// Path: web/assets/modules/ui/managers/sync_ui_manager.js
import { getLogger } from "utils/logger.js";
import { GoogleAuthManager } from "services/sync/google_auth_manager.js";
import { SyncOrchestrator } from "services/sync/sync_orchestrator.js";

const logger = getLogger("SyncUIManager");

export const SyncUIManager = {
    init() {
        this.els = {
            status: document.getElementById("sync-status"),
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
    },

    _setupEventListeners() {
        this.els.btnLogin.onclick = () => {
            const clientId = this.els.clientIdInput.value.trim();
            if (!clientId) {
                this.els.clientIdInput.classList.remove("hidden");
                this.els.clientIdInput.focus();
                alert("Please enter your Google Client ID first.");
                return;
            }
            GoogleAuthManager.setClientId(clientId);
            GoogleAuthManager.login();
        };

        this.els.btnLogout.onclick = () => {
            if (confirm("Logout from Google Sync?")) {
                GoogleAuthManager.logout();
                this._updateUI();
            }
        };

        this.els.btnPush.onclick = async () => {
            if (confirm("Overwrite Cloud data with Local data?")) {
                this._setStatus("Pushing...");
                await SyncOrchestrator.forcePush();
                this._setStatus("Cloud Updated");
                setTimeout(() => this._updateUI(), 2000);
            }
        };

        this.els.btnPull.onclick = async () => {
            if (confirm("Overwrite Local data with Cloud data? This will refresh your bookmarks and settings.")) {
                this._setStatus("Pulling...");
                await SyncOrchestrator.forcePull();
                this._setStatus("Local Updated");
                setTimeout(() => this._updateUI(), 2000);
            }
        };

        this.els.clientIdInput.onchange = (e) => {
            GoogleAuthManager.setClientId(e.target.value.trim());
        };

        // Listen for Auth Events
        window.addEventListener("google-auth-success", () => this._updateUI());
        window.addEventListener("google-auth-logout", () => this._updateUI());
    },

    _loadSettings() {
        const savedId = GoogleAuthManager.loadClientId();
        if (savedId) {
            this.els.clientIdInput.value = savedId;
        } else {
            this.els.clientIdInput.classList.remove("hidden");
        }
    },

    _updateUI() {
        const isAuthed = GoogleAuthManager.isAuthenticated();
        
        if (isAuthed) {
            this.els.btnLogin.classList.add("hidden");
            this.els.manualControls.classList.remove("hidden");
            this.els.clientIdInput.classList.add("hidden");
            this._setStatus("Google Sync: On");
        } else {
            this.els.btnLogin.classList.remove("hidden");
            this.els.manualControls.classList.add("hidden");
            this.els.clientIdInput.classList.remove("hidden");
            this._setStatus("Google Sync: Off");
        }
    },

    _setStatus(text) {
        if (this.els.status) this.els.status.textContent = text;
    }
};