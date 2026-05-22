// Path: web/assets/modules/ui/managers/sync_ui_manager.js
import { getLogger } from "utils/logger.js";
import { GithubAuthManager } from "services/sync/github_auth_manager.js";
import { SyncOrchestrator } from "services/sync/sync_orchestrator.js";

const logger = getLogger("SyncUIManager");

export const SyncUIManager = {
    init() {
        this.els = {
            widget: document.getElementById("sync-widget"),
            btnLogin: document.getElementById("btn-sync-login"),
            btnConnect: document.getElementById("btn-sync-connect"),
            btnLogout: document.getElementById("btn-sync-logout"),
            btnPush: document.getElementById("btn-sync-push"),
            btnPull: document.getElementById("btn-sync-pull"),
            manualControls: document.getElementById("sync-manual-controls"),
            inputArea: document.getElementById("sync-input-area"),
            clientIdInput: document.getElementById("sync-client-id") // We'll keep the ID but treat it as PAT input
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
            
            if (this.els.inputArea.classList.contains("hidden")) {
                this.els.inputArea.classList.remove("hidden");
                this.els.clientIdInput.placeholder = "Enter GitHub PAT (repo scope)";
                this.els.clientIdInput.focus();
            } else {
                this.els.inputArea.classList.add("hidden");
            }
        };

        this.els.btnConnect.onclick = async (e) => {
            e.stopPropagation();
            const token = this.els.clientIdInput.value.trim();
            if (!token) {
                alert("Please paste your GitHub Personal Access Token (PAT).");
                return;
            }
            
            this.els.btnConnect.disabled = true;
            this.els.btnConnect.innerText = "Connecting...";
            
            try {
                await GithubAuthManager.login(token);
            } catch (err) {
                alert("Failed to authenticate with GitHub. Check your token.");
            } finally {
                this.els.btnConnect.disabled = false;
                this.els.btnConnect.innerText = "Connect";
            }
        };

        this.els.btnLogout.onclick = (e) => {
            e.stopPropagation();
            if (confirm("Logout from GitHub Sync?")) {
                GithubAuthManager.logout();
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

        this.els.clientIdInput.onclick = (e) => e.stopPropagation();

        // Listen for Auth Events
        window.addEventListener("github-auth-success", () => this._updateUI());
        window.addEventListener("github-auth-logout", () => this._updateUI());
    },

    _loadSettings() {
        // Not auto-filling PAT for security reasons
    },

    _updateUI() {
        const isAuthed = GithubAuthManager.isAuthenticated();
        
        if (isAuthed) {
            this.els.btnLogin.classList.add("hidden");
            this.els.manualControls.classList.remove("hidden");
            this.els.inputArea.classList.add("hidden");
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