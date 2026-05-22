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

        const diffHtml = this._computeHunkDiffHtml(localStr, cloudStr);
        document.getElementById("unif-diff-content").innerHTML = diffHtml;
        document.getElementById("unif-diff-area").classList.add("hidden"); 

        // Update the 'Latest' hint
        const isCloudNewer = cloudData.timestamp > localData.timestamp;
        const latestLabel = isCloudNewer ? "Cloud" : "Local";
        const latestTime = new Date(Math.max(cloudData.timestamp, localData.timestamp)).toLocaleTimeString();
        document.getElementById("unif-latest-hint").innerText = `(${latestLabel} version is newer: ${latestTime})`;
        
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
                    <p>Conflict detected. How would you like to resolve it?</p>
                </div>

                <div class="unification-actions-main">
                    <button class="resolve-card primary" id="btn-unif-merge">
                        <span class="card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                        </span>
                        <div class="card-text">
                            <strong>Smart Merge</strong>
                            <p>Safely combine changes from both sides.</p>
                        </div>
                    </button>
                    
                    <button class="resolve-card" id="btn-unif-latest">
                        <span class="card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m19 15-7 7-7-7"/><path d="m19 9-7-7-7 7"/></svg>
                        </span>
                        <div class="card-text">
                            <strong>Use Latest</strong>
                            <p id="unif-latest-hint" style="color: var(--primary-color); font-weight: 500;"></p>
                        </div>
                    </button>

                    <div class="resolve-row">
                        <button class="resolve-card-small" id="btn-unif-cloud">Use Cloud</button>
                        <button class="resolve-card-small" id="btn-unif-local">Keep Local</button>
                    </div>
                </div>

                <div class="unification-footer">
                    <button class="text-link-btn" id="btn-unif-toggle-details">Show technical diff ↓</button>
                    <div id="unif-diff-area" class="hidden">
                        <div class="diff-view" id="unif-diff-content"></div>
                    </div>
                </div>
            </div>
            <style>
                .sync-unification-modal { z-index: 10000; position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
                .unification-content { background: var(--bg-body); border: 1px solid var(--border-color); padding: 24px; border-radius: 12px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-hover); color: var(--text-main); font-family: var(--font-main); }
                
                .unification-header h3 { margin-bottom: 4px; color: var(--primary-color); font-weight: 600; font-size: 18px; }
                .unification-header p { font-size: 13px; color: var(--text-muted); }

                .unification-actions-main { display: flex; flex-direction: column; gap: 8px; margin: 20px 0; }
                .resolve-card { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.2s; color: inherit; }
                .resolve-card.primary { border-color: var(--primary-color); background: var(--bg-hover); }
                .resolve-card:hover { border-color: var(--primary-color); background: var(--bg-hover); }
                .resolve-card .card-icon { color: var(--primary-color); opacity: 0.8; flex-shrink: 0; }
                .resolve-card strong { display: block; font-size: 14px; margin-bottom: 2px; }
                .resolve-card p { font-size: 11px; color: var(--text-muted); margin: 0; }

                .resolve-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .resolve-card-small { padding: 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; font-size: 12px; color: var(--text-muted); transition: all 0.2s; }
                .resolve-card-small:hover { color: var(--text-main); border-color: var(--text-muted); }

                .unification-footer { border-top: 1px solid var(--border-color); padding-top: 12px; }
                .text-link-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 11px; padding: 4px 0; text-decoration: underline; }
                
                #unif-diff-area { margin-top: 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-paper); max-height: 300px; overflow-y: auto; }
                .diff-view { font-family: monospace; font-size: 10px; line-height: 1.4; padding: 10px; white-space: pre; }
                .diff-hunk-header { background: rgba(var(--primary-rgb), 0.05); color: var(--primary-color); padding: 2px 4px; display: block; font-style: italic; border-bottom: 1px solid var(--border-light); }
                .diff-line { display: block; padding: 0 4px; border-left: 2px solid transparent; }
                .diff-line.add { background-color: rgba(46, 160, 67, 0.1); border-left-color: #3fb950; }
                .diff-line.remove { background-color: rgba(248, 81, 73, 0.1); border-left-color: #f85149; }
                .diff-prefix { display: inline-block; width: 10px; user-select: none; opacity: 0.5; }
            </style>
        `;

        div.querySelector("#btn-unif-local").onclick = () => this._handle("local");
        div.querySelector("#btn-unif-cloud").onclick = () => this._handle("cloud");
        div.querySelector("#btn-unif-latest").onclick = () => this._handle("latest");
        div.querySelector("#btn-unif-merge").onclick = () => this._handle("merge");
        div.querySelector("#btn-unif-toggle-details").onclick = () => {
            const area = div.querySelector("#unif-diff-area");
            area.classList.toggle("hidden");
            div.querySelector("#btn-unif-toggle-details").innerText = area.classList.contains("hidden") 
                ? "Show technical diff ↓" 
                : "Hide technical diff ↑";
        };

        return div;
    },

    _handle(choice) {
        this.hide();
        if (this._onResolve) this._onResolve(choice);
    },

    _computeHunkDiffHtml(oldStr, newStr) {
        const oldLines = oldStr.split('\n');
        const newLines = newStr.split('\n');
        
        // Standard LCS to get line-by-line diff
        const matrix = Array(oldLines.length + 1).fill().map(() => Array(newLines.length + 1).fill(0));
        for (let i = 1; i <= oldLines.length; i++) {
            for (let j = 1; j <= newLines.length; j++) {
                if (oldLines[i - 1] === newLines[j - 1]) matrix[i][j] = matrix[i - 1][j - 1] + 1;
                else matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }

        const fullDiff = [];
        let i = oldLines.length, j = newLines.length;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                fullDiff.unshift({ type: 'equal', val: oldLines[i - 1] });
                i--; j--;
            } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
                fullDiff.unshift({ type: 'add', val: newLines[j - 1] });
                j--;
            } else {
                fullDiff.unshift({ type: 'remove', val: oldLines[i - 1] });
                i--;
            }
        }

        // --- Hunk Creation Logic ---
        const contextLines = 2;
        const hunks = [];
        let currentHunk = null;

        fullDiff.forEach((line, idx) => {
            const isChanged = line.type !== 'equal';
            
            // Check if this line or any nearby line is changed
            let shouldShow = isChanged;
            if (!shouldShow) {
                for (let k = 1; k <= contextLines; k++) {
                    if (fullDiff[idx - k]?.type && fullDiff[idx - k].type !== 'equal') shouldShow = true;
                    if (fullDiff[idx + k]?.type && fullDiff[idx + k].type !== 'equal') shouldShow = true;
                }
            }

            if (shouldShow) {
                if (!currentHunk) {
                    currentHunk = { startIdx: idx, lines: [] };
                    hunks.push(currentHunk);
                }
                currentHunk.lines.push(line);
            } else {
                currentHunk = null;
            }
        });

        // Generate HTML
        return hunks.map((hunk, hIdx) => {
            const linesHtml = hunk.lines.map(line => {
                const cls = line.type === 'add' ? 'add' : (line.type === 'remove' ? 'remove' : '');
                const prefix = line.type === 'add' ? '+' : (line.type === 'remove' ? '-' : ' ');
                return `<span class="diff-line ${cls}"><span class="diff-prefix">${prefix}</span>${this._escapeHtml(line.val)}</span>`;
            }).join('');

            const header = `<span class="diff-hunk-header">@@ hunk ${hIdx + 1} @@</span>`;
            return header + linesHtml;
        }).join('<span class="diff-line">...</span>');
    },

    _escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }
};