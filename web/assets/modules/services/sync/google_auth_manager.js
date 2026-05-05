// Path: web/assets/modules/services/sync/google_auth_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("GoogleAuthManager");

export const GoogleAuthManager = {
    CLIENT_ID: "", // To be filled by user in UI or via config
    SCOPES: "https://www.googleapis.com/auth/drive.appdata",
    REDIRECT_URI: window.location.origin + window.location.pathname,
    AUTH_URL: "https://accounts.google.com/o/oauth2/v2/auth",
    TOKEN_KEY: "google_sync_token",
    CUSTOM_SCHEME: "randomsutta://auth-callback",

    init() {
        this.handleCallback();
    },

    isNative() {
        return (window.Capacitor && window.Capacitor.isNativePlatform()) || !!window.__TAURI_INTERNALS__;
    },

    handleCallback() {
        const hash = window.location.hash;
        if (hash.includes("access_token")) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get("access_token");
            const expiresIn = params.get("expires_in");
            const state = params.get("state");
            
            if (token) {
                // Check if we need to hand over to native app
                if (!this.isNative() && state === "origin=native") {
                    logger.info("Callback", "Handing over token to native app via deep link...");
                    window.location.href = `${this.CUSTOM_SCHEME}#${hash.substring(1)}`;
                    return;
                }

                this._processToken(token, expiresIn);
            }
        }
    },

    handleNativeCallback(urlStr) {
        try {
            const url = new URL(urlStr.replace("#", "?")); // URL parser handles params better if they are after ?
            const token = url.searchParams.get("access_token");
            const expiresIn = url.searchParams.get("expires_in");
            
            if (token) {
                logger.info("NativeCallback", "Received token from deep link");
                this._processToken(token, expiresIn);
            }
        } catch (e) {
            logger.error("NativeCallback", "Failed to parse native callback URL", e);
        }
    },

    _processToken(token, expiresIn) {
        const expiryTime = Date.now() + (parseInt(expiresIn) * 1000);
        this.saveToken({ token, expiryTime });
        logger.info("Auth", "Authentication successful");
        
        // Clear hash from URL if on web
        if (!this.isNative()) {
            window.history.replaceState(null, null, window.location.pathname + window.location.search);
        }
        
        // Trigger an event for SyncOrchestrator
        window.dispatchEvent(new CustomEvent("google-auth-success"));
    },

    login() {
        if (!this.CLIENT_ID) {
            logger.error("Login", "Client ID is not set. Please set it in Settings.");
            return;
        }

        let redirectUri = this.REDIRECT_URI;
        let state = "";

        // For Native apps, we use the web version of the app as intermediate redirect
        // This is because Google OAuth restricts redirect_uris to https/localhost
        if (this.isNative()) {
            // Assume the web version is at a known URL or configured
            // If the app is hosted on GH Pages, use that.
            // For now, let's try to use the current origin if it's https
            if (window.location.origin.startsWith("https")) {
                redirectUri = window.location.origin + window.location.pathname;
                state = "origin=native";
            } else {
                // Fallback for local development or if origin is null (file://)
                // You might need to hardcode the production URL here if origin is not available
                redirectUri = "https://hieucao.github.io/random_sutta/"; 
                state = "origin=native";
            }
        }

        const url = `${this.AUTH_URL}?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(this.SCOPES)}&prompt=consent&state=${encodeURIComponent(state)}`;
        
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            // Use Browser plugin for Capacitor to open in external browser
            import('@capacitor/browser').then(({ Browser }) => {
                Browser.open({ url });
            });
        } else {
            window.location.href = url;
        }
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