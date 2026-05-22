// Path: web/assets/modules/services/sync/github_auth_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("GithubAuthManager");
const STORAGE_KEY = "github_sync_pat";
const REPO_NAME = "random-sutta-sync";

export const GithubAuthManager = {
    _token: null,
    _username: null,

    init() {
        this._token = localStorage.getItem(STORAGE_KEY);
        if (this._token) {
            // Validate token asynchronously on init
            this.validateToken(this._token).catch(() => {
                logger.warn("Init", "Stored token is invalid, logging out.");
                this.logout();
            });
        }
    },

    isAuthenticated() {
        return !!this._token && !!this._username;
    },

    getToken() {
        return this._token;
    },

    getUsername() {
        return this._username;
    },
    
    getRepoName() {
        return REPO_NAME;
    },

    async login(token) {
        if (!token) throw new Error("Token is required");
        
        try {
            logger.info("Login", "Validating token...");
            const username = await this.validateToken(token);
            
            this._token = token;
            this._username = username;
            localStorage.setItem(STORAGE_KEY, token);
            
            logger.info("Login", `Authenticated as ${username}`);
            
            // Ensure repo exists
            await this.ensureRepoExists();

            window.dispatchEvent(new CustomEvent("github-auth-success"));
            return true;
        } catch (error) {
            logger.error("Login", "Authentication failed:", error);
            this.logout();
            throw error;
        }
    },

    logout() {
        this._token = null;
        this._username = null;
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new CustomEvent("github-auth-logout"));
    },

    async validateToken(token) {
        const response = await fetch("https://api.github.com/user", {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!response.ok) {
            throw new Error(`Invalid token: ${response.status}`);
        }

        const data = await response.json();
        this._username = data.login;
        return data.login;
    },

    async ensureRepoExists() {
        if (!this.isAuthenticated()) throw new Error("Not authenticated");

        // 1. Check if repo exists
        const checkRes = await fetch(`https://api.github.com/repos/${this._username}/${REPO_NAME}`, {
            headers: {
                "Authorization": `Bearer ${this._token}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (checkRes.ok) {
            logger.info("EnsureRepo", `Repo ${REPO_NAME} exists.`);
            return;
        }

        if (checkRes.status === 404) {
            logger.info("EnsureRepo", `Repo ${REPO_NAME} not found. Creating...`);
            // 2. Create repo
            const createRes = await fetch("https://api.github.com/user/repos", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this._token}`,
                    "Accept": "application/vnd.github.v3+json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: REPO_NAME,
                    description: "Sync repository for Random Sutta Reader",
                    private: true,
                    has_issues: false,
                    has_projects: false,
                    has_wiki: false
                })
            });

            if (!createRes.ok) {
                const errorData = await createRes.json();
                throw new Error(`Failed to create repo: ${errorData.message}`);
            }
            logger.info("EnsureRepo", "Repo created successfully.");
        } else {
            throw new Error(`Error checking repo: ${checkRes.status}`);
        }
    }
};
