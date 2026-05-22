// Path: web/assets/modules/ui/managers/sync_conflict_ui.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("SyncConflictUI");

export const SyncConflictUI = {
    _onResolve: null,

    show(localData, cloudData, onResolve) {
        this._onResolve = onResolve;
        
        let modal = document.getElementById("sync-conflict-modal");
        if (!modal) {
            modal = this._createModal();
            document.body.appendChild(modal);
        }

        const localStr = JSON.stringify(localData.payload, null, 2);
        const cloudStr = JSON.stringify(cloudData.payload, null, 2);

        const diffHtml = this._computeDiffHtml(localStr, cloudStr);
        document.getElementById("conf-diff-content").innerHTML = diffHtml;
        document.getElementById("conf-diff-area").classList.add("hidden"); // Hide details by default
        
        modal.classList.remove("hidden");
    },

    hide() {
        const modal = document.getElementById("sync-conflict-modal");
        if (modal) modal.classList.add("hidden");
    },

    _createModal() {
        const div = document.createElement("div");
        div.id = "sync-conflict-modal";
        div.className = "modal-overlay sync-conflict-modal hidden";
        div.innerHTML = `
            <div class="modal-content conflict-content">
                <div class="conflict-header">
                    <h3>⚠️ Sync Conflict Detected</h3>
                    <p>Dữ liệu trên GitHub đã thay đổi từ một thiết bị khác. Bạn muốn xử lý như thế nào?</p>
                </div>

                <div class="conflict-actions-main">
                    <button class="resolve-card" id="btn-conf-merge">
                        <span class="card-icon">🔀</span>
                        <div class="card-text">
                            <strong>Smart Merge</strong>
                            <p>Gộp thông minh các thay đổi từ cả hai bên (Khuyên dùng)</p>
                        </div>
                    </button>
                    <button class="resolve-card" id="btn-conf-cloud">
                        <span class="card-icon">☁️</span>
                        <div class="card-text">
                            <strong>Use Cloud</strong>
                            <p>Ghi đè máy này bằng dữ liệu trên GitHub</p>
                        </div>
                    </button>
                    <button class="resolve-card" id="btn-conf-local">
                        <span class="card-icon">💻</span>
                        <div class="card-text">
                            <strong>Keep Local</strong>
                            <p>Ghi đè GitHub bằng dữ liệu của máy này</p>
                        </div>
                    </button>
                </div>

                <div class="conflict-footer">
                    <button class="text-link-btn" id="btn-conf-toggle-details">View Changes (Git-style Diff) ↓</button>
                    <div id="conf-diff-area" class="hidden">
                        <div class="diff-view" id="conf-diff-content"></div>
                    </div>
                </div>
            </div>
            <style>
                .sync-conflict-modal { z-index: 10000; position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
                .conflict-content { background: var(--bg-body); border: 2px solid var(--primary-color); padding: 32px; border-radius: 16px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-hover); color: var(--text-main); }
                
                .conflict-header h3 { margin-bottom: 8px; color: var(--primary-color); }
                .conflict-header p { font-size: 14px; opacity: 0.9; }

                .conflict-actions-main { display: flex; flex-direction: column; gap: 12px; margin: 24px 0; }
                .resolve-card { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; cursor: pointer; text-align: left; transition: all 0.2s; }
                .resolve-card:hover { border-color: var(--primary-color); background: var(--bg-hover); transform: translateY(-2px); }
                .resolve-card .card-icon { font-size: 24px; }
                .resolve-card strong { display: block; font-size: 16px; margin-bottom: 2px; }
                .resolve-card p { font-size: 13px; color: var(--text-muted); margin: 0; }

                .conflict-footer { border-top: 1px solid var(--border-color); padding-top: 16px; }
                .text-link-btn { background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 13px; padding: 4px 0; text-decoration: underline; }
                
                #conf-diff-area { margin-top: 16px; border: 1px solid var(--border-color); border-radius: 8px; background: #f6f8fa; overflow: hidden; }
                [data-theme="dark"] #conf-diff-area { background: #0d1117; }
                
                .diff-view { font-family: monospace; font-size: 12px; line-height: 1.5; overflow-x: auto; padding: 12px; white-space: pre; }
                .diff-line { display: block; padding: 0 4px; }
                .diff-line.add { background-color: #dafbe1; color: #1a7f37; }
                .diff-line.remove { background-color: #feebe9; color: #cf222e; }
                [data-theme="dark"] .diff-line.add { background-color: #163b22; color: #3fb950; }
                [data-theme="dark"] .diff-line.remove { background-color: #67060c; color: #f85149; }
                .diff-prefix { display: inline-block; width: 15px; user-select: none; opacity: 0.7; }
            </style>
        `;

        div.querySelector("#btn-conf-local").onclick = () => this._handle("local");
        div.querySelector("#btn-conf-cloud").onclick = () => this._handle("cloud");
        div.querySelector("#btn-conf-merge").onclick = () => this._handle("merge");
        div.querySelector("#btn-conf-toggle-details").onclick = () => {
            const area = div.querySelector("#conf-diff-area");
            area.classList.toggle("hidden");
            div.querySelector("#btn-conf-toggle-details").innerText = area.classList.contains("hidden") 
                ? "View Changes (Git-style Diff) ↓" 
                : "Hide Changes ↑";
        };

        return div;
    },

    _handle(choice) {
        this.hide();
        if (this._onResolve) this._onResolve(choice);
    },

    /**
     * Simple LCS-based diff implementation for line-by-line comparison
     */
    _computeDiffHtml(oldStr, newStr) {
        const oldLines = oldStr.split('\n');
        const newLines = newStr.split('\n');
        
        // Basic Longest Common Subsequence (LCS)
        const matrix = Array(oldLines.length + 1).fill().map(() => Array(newLines.length + 1).fill(0));
        for (let i = 1; i <= oldLines.length; i++) {
            for (let j = 1; j <= newLines.length; j++) {
                if (oldLines[i - 1] === newLines[j - 1]) matrix[i][j] = matrix[i - 1][j - 1] + 1;
                else matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }

        const result = [];
        let i = oldLines.length, j = newLines.length;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                result.unshift({ type: 'equal', val: oldLines[i - 1] });
                i--; j--;
            } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
                result.unshift({ type: 'add', val: newLines[j - 1] });
                j--;
            } else {
                result.unshift({ type: 'remove', val: oldLines[i - 1] });
                i--;
            }
        }

        return result.map(line => {
            const cls = line.type === 'add' ? 'add' : (line.type === 'remove' ? 'remove' : '');
            const prefix = line.type === 'add' ? '+' : (line.type === 'remove' ? '-' : ' ');
            return `<span class="diff-line ${cls}"><span class="diff-prefix">${prefix}</span>${this._escapeHtml(line.val)}</span>`;
        }).join('');
    },

    _escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }
};
