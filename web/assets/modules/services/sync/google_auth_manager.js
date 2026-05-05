// Path: web/assets/modules/services/sync/google_auth_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("GoogleAuthManager");

export const GoogleAuthManager = {
    CLIENT_ID: "", // To be filled by user in UI or via config
    SCOPES: "https://www.googleapis.com/auth/drive.appdata",
    REDIRECT_URI: window.location.origin + window.location.pathname,
    AUTH_URL: "https://accounts.google.com/o/oauth2/v2/auth",
    TOKEN_KEY: "google_sync_token",

    init() {
        this.handleCallback();
    },

    handleCallback() {
        const hash = window.location.hash;
        if (hash.includes("access_token")) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get("access_token");
            const expiresIn = params.get("expires_in");
            
            if (token) {
                const expiryTime = Date.now() + (parseInt(expiresIn) * 1000);
                this.saveToken({ token, expiryTime });
                logger.info("Callback", "Authentication successful");
                
                // Clear hash from URL
                window.history.replaceState(null, null, window.location.pathname + window.location.search);
                
                // Trigger an event for SyncOrchestrator
                window.dispatchEvent(new CustomEvent("google-auth-success"));
            }
        }
    },

    login() {
        if (!this.CLIENT_ID) {
            logger.error("Login", "Client ID is not set. Please set it in Settings.");
            return;
        }

        const url = `${this.AUTH_URL}?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(this.SCOPES)}&prompt=consent`;
        window.location.href = url;
    },

    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        window.dispatchEvent(new CustomEvent("google-auth-logout"));
    },

    getToken() {
        const data = localStorage.getItem(this.TOKEN_KEY);
        if (!data) return null;

        const { token, expiryTime } = JSON.parse(data);
        if (Date.now() > expiryTime) {
            logger.warn("Token", "Token expired");
            this.logout();
            return null;
        }
        return token;
    },

    saveToken(data) {
        localStorage.setItem(this.TOKEN_KEY, JSON.stringify(data));
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    setClientId(clientId) {
        this.CLIENT_ID = clientId;
        localStorage.setItem("google_sync_client_id", clientId);
    },

    loadClientId() {
        this.CLIENT_ID = localStorage.getItem("google_sync_client_id") || "";
        return this.CLIENT_ID;
    }
};