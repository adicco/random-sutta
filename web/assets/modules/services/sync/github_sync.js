// Path: web/assets/modules/services/sync/github_sync.js
import { getLogger } from "utils/logger.js";
import { GithubAuthManager } from "services/sync/github_auth_manager.js";

const logger = getLogger("GithubSync");
const FILE_PATH = "sync.json";

export const GithubSync = {
    async _request(method, endpoint, body = null) {
        const token = GithubAuthManager.getToken();
        const username = GithubAuthManager.getUsername();
        const repo = GithubAuthManager.getRepoName();
        
        if (!token || !username) {
            throw new Error("Not authenticated");
        }

        const url = `https://api.github.com/repos/${username}/${repo}${endpoint}`;
        const options = {
            method,
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        if (!response.ok && response.status !== 404) {
            const err = await response.json();
            throw new Error(`GitHub API Error (${response.status}): ${err.message}`);
        }
        return response;
    },

    async downloadData(filePath = FILE_PATH) {
        try {
            logger.info("Download", `Fetching ${filePath}...`);
            const response = await this._request("GET", `/contents/${filePath}`);
            
            if (response.status === 404) {
                logger.info("Download", `File ${filePath} not found on cloud.`);
                return null;
            }

            const data = await response.json();
            
            // Decode Base64 content properly (handles Unicode)
            const binaryString = atob(data.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const decoder = new TextDecoder('utf-8');
            const content = decoder.decode(bytes);
            
            let parsed = content;
            if (filePath.endsWith(".json")) {
                parsed = JSON.parse(content);
            }
            
            return {
                data: parsed,
                sha: data.sha
            };
        } catch (error) {
            logger.error("Download", error);
            throw error;
        }
    },

    async uploadData(payload, currentSha = null, filePath = FILE_PATH) {
        try {
            logger.info("Upload", `Uploading ${filePath}...`);
            
            const contentString = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
            
            // Encode to Base64 (handles Unicode safely)
            const encoder = new TextEncoder();
            const bytes = encoder.encode(contentString);
            const binaryString = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
            const base64Content = btoa(binaryString);

            const body = {
                message: `Update ${filePath} from Random Sutta Reader`,
                content: base64Content
            };

            if (currentSha) {
                body.sha = currentSha;
            }

            const response = await this._request("PUT", `/contents/${FILE_PATH}`, body);
            const data = await response.json();
            
            logger.info("Upload", "Success");
            return data.content.sha; // Return new sha
        } catch (error) {
            logger.error("Upload", error);
            throw error;
        }
    }
};
