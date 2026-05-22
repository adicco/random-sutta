// Path: web/assets/modules/services/sync/github_auth_manager.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("GithubAuthManager");
const STORAGE_KEY_PAT = "github_sync_pat";
const STORAGE_KEY_REPO = "github_sync_repo";

export const GithubAuthManager = {
    _token: null,
    _username: null,
    _repo: null,

    init() {
        this._token = localStorage.getItem(STORAGE_KEY_PAT);
        this._repo = localStorage.getItem(STORAGE_KEY_REPO);
        if (this._token && this._repo) {
            // Validate token asynchronously on init
            this.validateToken(this._token).then(() => {
                logger.info("Init", "Stored session restored successfully.");
                window.dispatchEvent(new CustomEvent("github-auth-success"));
            }).catch(() => {
                logger.warn("Init", "Stored token is invalid, logging out.");
                this.logout();
            });
        }
    },

    isAuthenticated() {
        return !!this._token && !!this._username && !!this._repo;
    },

    getToken() {
        return this._token;
    },

    getUsername() {
        return this._username;
    },
    
    getRepoName() {
        return this._repo;
    },

    async login(token, repoName) {
        if (!token) throw new Error("Token is required");
        if (!repoName) throw new Error("Repository name is required");
        
        try {
            logger.info("Login", "Validating token...");
            const username = await this.validateToken(token);
            
            this._token = token;
            this._username = username;
            this._repo = repoName;
            localStorage.setItem(STORAGE_KEY_PAT, token);
            localStorage.setItem(STORAGE_KEY_REPO, repoName);
            
            logger.info("Login", `Authenticated as ${username} for repo ${repoName}`);
            
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
        this._repo = null;
        localStorage.removeItem(STORAGE_KEY_PAT);
        localStorage.removeItem(STORAGE_KEY_REPO);
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
        const checkRes = await fetch(`https://api.github.com/repos/${this._username}/${this._repo}`, {
            headers: {
                "Authorization": `Bearer ${this._token}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (checkRes.ok) {
            logger.info("EnsureRepo", `Repo ${this._repo} exists.`);
            return;
        }

        if (checkRes.status === 404) {
            logger.info("EnsureRepo", `Repo ${this._repo} not found. Creating...`);
            // 2. Create repo
            const createRes = await fetch("https://api.github.com/user/repos", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this._token}`,
                    "Accept": "application/vnd.github.v3+json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: this._repo,
                    description: "Sync repository for Random Sutta Reader (Auto-created)",
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
