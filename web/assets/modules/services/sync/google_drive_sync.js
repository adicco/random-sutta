// Path: web/assets/modules/services/sync/google_drive_sync.js
import { getLogger } from "utils/logger.js";
import { GoogleAuthManager } from "services/sync/google_auth_manager.js";

const logger = getLogger("GoogleDriveSync");

export const GoogleDriveSync = {
    FILE_NAME: "sync_data.json",
    BASE_URL: "https://www.googleapis.com/drive/v3/files",
    UPLOAD_URL: "https://www.googleapis.com/upload/drive/v3/files",

    async getHeaders() {
        const token = GoogleAuthManager.getToken();
        if (!token) throw new Error("Not authenticated");
        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };
    },

    async findFileId() {
        const headers = await this.getHeaders();
        const q = `name = '${this.FILE_NAME}' and 'appDataFolder' in parents`;
        const url = `${this.BASE_URL}?q=${encodeURIComponent(q)}&spaces=appDataFolder&fields=files(id, name)`;
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.files && data.files.length > 0) {
            return data.files[0].id;
        }
        return null;
    },

    async downloadData() {
        const fileId = await this.findFileId();
        if (!fileId) return null;

        const headers = await this.getHeaders();
        const url = `${this.BASE_URL}/${fileId}?alt=media`;
        
        const response = await fetch(url, { headers });
        if (response.status === 404) return null;
        return await response.json();
    },

    async uploadData(data) {
        const fileId = await this.findFileId();
        const headers = await this.getHeaders();
        
        const metadata = {
            name: this.FILE_NAME
        };

        // parents field is only allowed during creation (POST)
        if (!fileId) {
            metadata.parents = ["appDataFolder"];
        }

        const boundary = "-------314159265358979323846";
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const contentType = "application/json";
        const body =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: ' + contentType + '\r\n\r\n' +
            JSON.stringify(data) +
            close_delim;

        let url = this.UPLOAD_URL + "?uploadType=multipart";
        let method = "POST";

        if (fileId) {
            url = `${this.UPLOAD_URL}/${fileId}?uploadType=multipart`;
            method = "PATCH";
        }

        const response = await fetch(url, {
            method,
            headers: {
                ...headers,
                "Content-Type": `multipart/related; boundary=${boundary}`
            },
            body
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Upload failed: ${JSON.stringify(errorData)}`);
        }

        return await response.json();
    }
};