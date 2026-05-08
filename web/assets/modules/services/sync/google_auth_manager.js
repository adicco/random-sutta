// Path: web/assets/modules/services/sync/google_auth_manager.js
import { getLogger } from "utils/logger.js";
import { Browser } from '@capacitor/browser';

const logger = getLogger("GoogleAuthManager");

export const GoogleAuthManager = {
    // [FINAL CONFIG] Using the iOS-type Client ID for both macOS and Android
    // This is the only way to get Refresh Tokens (persistent login) without a Client Secret.
    CLIENT_ID: "103021460212-qk5ogq5es4dlpsmkf5a7q4h7nl7v9qle.apps.googleusercontent.com", 
    SCOPES: "https://www.googleapis.com/auth/drive.appdata",
    AUTH_URL: "https://accounts.google.com/o/oauth2/v2/auth",
    TOKEN_URL: "https://oauth2.googleapis.com/token",
    TOKEN_KEY: "google_sync_token",
    VERIFIER_KEY: "google_auth_verifier",

    init() {
        this._loadPlatformConfig();
        this.handleCallback();
        
        // Silent refresh on startup if possible
        this.getToken().then(t => {
            if (t) logger.info("Init", "Session active.");
        });
    },

    isNative() {
        return (window.Capacitor && window.Capacitor.isNativePlatform()) || !!window.__TAURI_INTERNALS__;
    },

    _loadPlatformConfig() {
        if (this.isNative()) {
            // Official Google format for iOS/macOS/Android: reversed.client.id:/oauth2redirect
            // IMPORTANT: Single slash after the colon is mandatory for Google's validation.
            this.REDIRECT_URI = `com.googleusercontent.apps.103021460212-qk5ogq5es4dlpsmkf5a7q4h7nl7v9qle:/oauth2redirect`;
        } else {
            // Web/PWA
            this.CLIENT_ID = "103021460212-ki69q4b1mfn72qn6f8lg8a199s3f6t5d.apps.googleusercontent.com";
            this.REDIRECT_URI = window.location.origin + window.location.pathname;
        }
    },

    handleCallback() {
        const url = new URL(window.location.href.replace("#", "?"));
        const code = url.searchParams.get("code");
        if (code) this._exchangeCodeForToken(code);
    },

    handleNativeCallback(urlStr) {
        try {
            logger.info("NativeCallback", "Received: " + urlStr);
            // Handle different scheme formats
            const normalizedUrl = urlStr.replace("#", "?").replace(":/", "://");
            const url = new URL(normalizedUrl); 
            const code = url.searchParams.get("code");
            
            if (code) {
                this._exchangeCodeForToken(code);
            }

            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                Browser.close().catch(e => logger.warn("NativeCallback", "Failed to close browser", e));
            }
        } catch (e) {
            logger.error("NativeCallback", "Parse error", e);
        }
    },

    async login() {
        this._loadPlatformConfig();
        
        const verifier = this._generateVerifier();
        localStorage.setItem(this.VERIFIER_KEY, verifier);
        const challenge = await this._generateChallenge(verifier);

        const url = `${this.AUTH_URL}?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(this.SCOPES)}&code_challenge=${challenge}&code_challenge_method=S256&prompt=consent&access_type=offline`;
        
        logger.info("Login", "Starting OAuth (Native):", this.REDIRECT_URI);

        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
             Browser.open({ url }).catch(e => logger.error("Login", "Failed to open browser", e));
        } else {
            window.location.href = url;
        }
    },

    async _exchangeCodeForToken(code) {
        const verifier = localStorage.getItem(this.VERIFIER_KEY);
        if (!verifier) {
            logger.error("Auth", "Verifier missing. Possible session timeout.");
            return;
        }

        try {
            const body = {
                client_id: this.CLIENT_ID,
                code: code,
                code_verifier: verifier,
                grant_type: 'authorization_code',
                redirect_uri: this.REDIRECT_URI
            };

            const response = await fetch(this.TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(body)
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error_description || data.error);

            this._processToken(data);
            localStorage.removeItem(this.VERIFIER_KEY);
        } catch (e) {
            logger.error("Auth", "Token exchange failed", e);
        }
    },

    _processToken(data) {
        const expiryTime = Date.now() + (parseInt(data.expires_in) * 1000);
        const tokenData = {
            token: data.access_token,
            refreshToken: data.refresh_token || this._getExistingRefreshToken(),
            expiryTime: expiryTime
        };

        this.saveToken(tokenData);
        logger.info("Auth", "Success! Persistent session: " + !!tokenData.refreshToken);
        
        if (!this.isNative()) {
            window.history.replaceState(null, null, window.location.pathname);
        }
        window.dispatchEvent(new CustomEvent("google-auth-success"));
    },

    _getExistingRefreshToken() {
        const saved = localStorage.getItem(this.TOKEN_KEY);
        if (saved) {
            try {
                return JSON.parse(saved).refreshToken;
            } catch (e) {}
        }
        return null;
    },

    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.VERIFIER_KEY);
        window.dispatchEvent(new CustomEvent("google-auth-logout"));
    },

    async getToken() {
        const dataStr = localStorage.getItem(this.TOKEN_KEY);
        if (!dataStr) return null;

        const data = JSON.parse(dataStr);
        if (Date.now() < data.expiryTime - 300000) {
            return data.token;
        }

        if (data.refreshToken) {
            logger.info("Auth", "Token expired, refreshing...");
            return await this._refreshToken(data.refreshToken);
        }

        this.logout();
        return null;
    },

    async _refreshToken(refreshToken) {
        try {
            const response = await fetch(this.TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.CLIENT_ID,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            this._processToken({
                access_token: data.access_token,
                expires_in: data.expires_in,
                refresh_token: refreshToken 
            });

            return data.access_token;
        } catch (e) {
            logger.error("Auth", "Refresh failed", e);
            this.logout();
            return null;
        }
    },

    saveToken(data) {
        localStorage.setItem(this.TOKEN_KEY, JSON.stringify(data));
    },

    isAuthenticated() {
        return !!localStorage.getItem(this.TOKEN_KEY);
    },

    _generateVerifier() {
        const array = new Uint32Array(56);
        window.crypto.getRandomValues(array);
        return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
    },

    async _generateChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(hash)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    setClientId(clientId) {
        localStorage.setItem("google_sync_client_id", clientId);
        this._loadPlatformConfig();
    },

    loadClientId() {
        this._loadPlatformConfig();
        return this.CLIENT_ID;
    }
};