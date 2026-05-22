// Path: web/assets/modules/services/sync/github_sync.js
import { getLogger } from "utils/logger.js";
import { GithubAuthManager } from "services/sync/github_auth_manager.js";

const logger = getLogger("GithubSync");
const FILE_PATH = "sync.json";

export const GithubSync = {
    /**
     * Internal request wrapper for GitHub REST API
     */
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
            const err = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(`GitHub API Error (${response.status}): ${err.message}`);
        }
        return response;
    },

    async downloadData(filePath = FILE_PATH) {
        try {
            logger.info("Download", `Fetching ${filePath}...`);
            const response = await this._request("GET", `/contents/${filePath}?cache_bust=${Date.now()}`);
            
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

    /**
     * Advanced Upload using Git Data API for clean commit history.
     * Logic: Get Main Ref -> Create Blob -> Create Tree (relative to old tree) -> Create Commit -> Update Ref.
     */
    async uploadData(payload, currentSha = null, filePath = FILE_PATH) {
        try {
            const deviceId = GithubAuthManager.getDeviceId();
            logger.info("Upload", `Uploading ${filePath} using Data API (Device: ${deviceId})...`);
            
            const contentString = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
            
            // 1. Get current branch reference (main)
            const refRes = await this._request("GET", "/git/refs/heads/main");
            const refData = await refRes.json();
            const lastCommitSha = refData.object.sha;

            // 2. Create a new Blob
            const blobRes = await this._request("POST", "/git/blobs", {
                content: contentString,
                encoding: "utf-8"
            });
            const blobData = await blobRes.json();
            const newBlobSha = blobData.sha;

            // 3. Create a new Tree
            // This replaces the file at 'filePath' with the new blob, basing it on the last commit's tree
            const treeRes = await this._request("POST", "/git/trees", {
                base_tree: lastCommitSha,
                tree: [
                    {
                        path: filePath,
                        mode: "100644",
                        type: "blob",
                        sha: newBlobSha
                    }
                ]
            });
            const treeData = await treeRes.json();
            const newTreeSha = treeData.sha;

            // 4. Create the Commit
            const commitMessage = `Sync: Update ${filePath} [${deviceId}]`;
            const commitRes = await this._request("POST", "/git/commits", {
                message: commitMessage,
                tree: newTreeSha,
                parents: [lastCommitSha]
            });
            const commitData = await commitRes.json();
            const newCommitSha = commitData.sha;

            // 5. Update the Reference (Main branch)
            // 'force: true' handles the case where someone else pushed in the meantime (Data API is low level)
            // However, we rely on our high-level Sha checks in SyncOrchestrator to avoid losing data.
            await this._request("PATCH", "/git/refs/heads/main", {
                sha: newCommitSha,
                force: true 
            });

            logger.info("Upload", "Data API Success.");
            
            // Return the SHA of the FILE (not the commit) to stay compatible with existing logic
            // We need to fetch the file info again to get the NEW sha of the file itself
            const fileRes = await this._request("GET", `/contents/${filePath}`);
            const fileData = await fileRes.json();
            return fileData.sha;

        } catch (error) {
            logger.error("Upload Data API", error);
            throw error;
        }
    }
};
