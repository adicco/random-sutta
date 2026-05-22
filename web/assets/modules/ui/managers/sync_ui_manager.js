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
            manualControls: document.getElementById("sync-manual-controls"),
            inputArea: document.getElementById("sync-input-area"),
            clientIdInput: document.getElementById("sync-client-id"), // Used for PAT
            repoNameInput: null,
            deviceNameInput: null
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
                this.els.clientIdInput.placeholder = "GitHub PAT";
                this.els.clientIdInput.type = "password"; // Mask the token
                
                // Add Device Name Input
                if (!document.getElementById("sync-device-name")) {
                    const deviceInput = document.createElement("input");
                    deviceInput.id = "sync-device-name";
                    deviceInput.type = "text";
                    deviceInput.placeholder = "Device Name (e.g. My Phone)";
                    deviceInput.className = "sync-id-input";
                    deviceInput.style.marginBottom = "8px";
                    deviceInput.value = GithubAuthManager.getDeviceId() || "";
                    this.els.clientIdInput.parentNode.insertBefore(deviceInput, this.els.clientIdInput);
                    this.els.deviceNameInput = deviceInput;
                    deviceInput.onclick = (e) => e.stopPropagation();
                }

                // Add Repo Input if it doesn't exist (Optional field)
                if (!document.getElementById("sync-repo-name")) {
                    const repoInput = document.createElement("input");
                    repoInput.id = "sync-repo-name";
                    repoInput.type = "text";
                    repoInput.placeholder = "Repo Name (Default: rsnote)";
                    repoInput.className = "sync-id-input"; 
                    repoInput.style.marginTop = "8px";
                    repoInput.style.marginBottom = "8px";
                    this.els.clientIdInput.parentNode.insertBefore(repoInput, this.els.btnConnect);
                    this.els.repoNameInput = repoInput;
                    repoInput.onclick = (e) => e.stopPropagation();
                }

                this.els.clientIdInput.focus();
            } else {
                this.els.inputArea.classList.add("hidden");
            }
        };

        this.els.btnConnect.onclick = async (e) => {
            e.stopPropagation();
            const token = this.els.clientIdInput.value.trim();
            const repoName = (this.els.repoNameInput && this.els.repoNameInput.value.trim()) || "rsnote";
            const deviceName = (this.els.deviceNameInput && this.els.deviceNameInput.value.trim()) || "";

            if (!token) {
                alert("Please enter your GitHub Personal Access Token (PAT).");
                return;
            }
            
            this.els.btnConnect.disabled = true;
            this.els.btnConnect.innerText = "Connecting...";
            
            try {
                await GithubAuthManager.login(token, repoName, deviceName);
            } catch (err) {
                alert("Failed to connect: " + err.message);
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
