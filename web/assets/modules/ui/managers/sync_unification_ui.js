// Path: web/assets/modules/ui/managers/sync_unification_ui.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("SyncUnificationUI");

export const SyncUnificationUI = {
    _onResolve: null,

    show(localData, cloudData, onResolve) {
        this._onResolve = onResolve;
        
        let modal = document.getElementById("sync-unification-modal");
        if (!modal) {
            modal = this._createModal();
            document.body.appendChild(modal);
        }

        const localStr = JSON.stringify(localData.payload, null, 2);
        const cloudStr = JSON.stringify(cloudData.payload, null, 2);

        const diffHtml = this._computeDiffHtml(localStr, cloudStr);
        document.getElementById("unif-diff-content").innerHTML = diffHtml;
        document.getElementById("unif-diff-area").classList.add("hidden"); 
        
        modal.classList.remove("hidden");
    },

    hide() {
        const modal = document.getElementById("sync-unification-modal");
        if (modal) modal.classList.add("hidden");
    },

    _createModal() {
        const div = document.createElement("div");
        div.id = "sync-unification-modal";
        div.className = "modal-overlay sync-unification-modal hidden";
        div.innerHTML = `
            <div class="modal-content unification-content">
                <div class="unification-header">
                    <h3>Sync Unification</h3>
                    <p>New updates were detected on GitHub. Choose how you'd like to proceed.</p>
                </div>

                <div class="unification-actions-main">
                    <button class="resolve-card" id="btn-unif-merge">
                        <span class="card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                        </span>
                        <div class="card-text">
                            <strong>Smart Merge</strong>
                            <p>Combine changes from both sides safely.</p>
                        </div>
                    </button>
                    <button class="resolve-card" id="btn-unif-cloud">
                        <span class="card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19A5.5 5.5 0 0 0 18 8.02a1 1 0 0 0-1-1.02H16V7a4 4 0 0 0-8 0v.5H7a4.5 4.5 0 0 0 0 9c.14 0 .28 0 .41-.02"/><path d="M12 13v8"/><path d="m15 18-3 3-3-3"/></svg>
                        </span>
                        <div class="card-text">
                            <strong>Use Cloud</strong>
                            <p>Update this device with data from GitHub.</p>
                        </div>
                    </button>
                    <button class="resolve-card" id="btn-unif-local">
                        <span class="card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                        </span>
                        <div class="card-text">
                            <strong>Keep Local</strong>
                            <p>Overwrite GitHub with data from this device.</p>
                        </div>
                    </button>
                </div>

                <div class="unification-footer">
                    <button class="text-link-btn" id="btn-unif-toggle-details">Compare changes ↓</button>
                    <div id="unif-diff-area" class="hidden">
                        <div class="diff-view" id="unif-diff-content"></div>
                    </div>
                </div>
            </div>
            <style>
                .sync-unification-modal { z-index: 10000; position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(2px); }
                .unification-content { background: var(--bg-body); border: 1px solid var(--border-color); padding: 32px; border-radius: 12px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-hover); color: var(--text-main); font-family: var(--font-main); }
                
                .unification-header h3 { margin-bottom: 8px; color: var(--primary-color); font-weight: 600; font-size: 20px; }
                .unification-header p { font-size: 14px; color: var(--text-muted); line-height: 1.4; }

                .unification-actions-main { display: flex; flex-direction: column; gap: 8px; margin: 24px 0; }
                .resolve-card { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s; color: inherit; }
                .resolve-card:hover { border-color: var(--primary-color); background: var(--bg-hover); }
                .resolve-card .card-icon { color: var(--primary-color); opacity: 0.8; flex-shrink: 0; }
                .resolve-card strong { display: block; font-size: 15px; margin-bottom: 2px; font-weight: 500; }
                .resolve-card p { font-size: 12px; color: var(--text-muted); margin: 0; }

                .unification-footer { border-top: 1px solid var(--border-color); padding-top: 16px; }
                .text-link-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; padding: 4px 0; text-decoration: underline; font-family: inherit; }
                .text-link-btn:hover { color: var(--primary-color); }
                
                #unif-diff-area { margin-top: 16px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-paper); overflow: hidden; }
                
                .diff-view { font-family: monospace; font-size: 11px; line-height: 1.4; overflow-x: auto; padding: 12px; white-space: pre; background: rgba(0,0,0,0.02); }
                [data-theme="dark"] .diff-view { background: rgba(255,255,255,0.02); }
                
                .diff-line { display: block; padding: 0 4px; }
                .diff-line.add { background-color: rgba(46, 160, 67, 0.15); color: #3fb950; }
                .diff-line.remove { background-color: rgba(248, 81, 73, 0.15); color: #f85149; }
                .diff-prefix { display: inline-block; width: 12px; user-select: none; opacity: 0.5; }
            </style>
        `;

        div.querySelector("#btn-unif-local").onclick = () => this._handle("local");
        div.querySelector("#btn-unif-cloud").onclick = () => this._handle("cloud");
        div.querySelector("#btn-unif-merge").onclick = () => this._handle("merge");
        div.querySelector("#btn-unif-toggle-details").onclick = () => {
            const area = div.querySelector("#unif-diff-area");
            area.classList.toggle("hidden");
            div.querySelector("#btn-unif-toggle-details").innerText = area.classList.contains("hidden") 
                ? "Compare changes ↓" 
                : "Hide changes ↑";
        };

        return div;
    },

    _handle(choice) {
        this.hide();
        if (this._onResolve) this._onResolve(choice);
    },

    _computeDiffHtml(oldStr, newStr) {
        const oldLines = oldStr.split('\n');
        const newLines = newStr.split('\n');
        
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