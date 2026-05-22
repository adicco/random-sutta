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
                <button class="modal-close-btn" id="btn-unif-close" title="Ignore for now">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div class="unification-header">
                    <h3>Sync Unification</h3>
                    <p>Conflict detected. How would you like to resolve it?</p>
                </div>

                <div class="unification-actions-main">
                    <button class="resolve-card primary" id="btn-unif-latest">
                        <span class="card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </span>
                        <div class="card-text">
                            <strong>Use Latest</strong>
                            <p id="unif-latest-hint" class="unif-latest-hint"></p>
                        </div>
                    </button>

                    <button class="resolve-card" id="btn-unif-merge">
                        <span class="card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                        </span>
                        <div class="card-text">
                            <strong>Smart Merge</strong>
                            <p>Safely combine changes from both sides.</p>
                        </div>
                    </button>
                    
                    <div class="resolve-row">
                        <button class="resolve-card-small" id="btn-unif-cloud">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="small-icon"><path d="M17.5 19A5.5 5.5 0 0 0 18 8.02a1 1 0 0 0-1-1.02H16V7a4 4 0 0 0-8 0v.5H7a4.5 4.5 0 0 0 0 9c.14 0 .28 0 .41-.02"/><path d="M12 13v8"/><path d="m15 18-3 3-3-3"/></svg>
                            Use Cloud
                        </button>
                        <button class="resolve-card-small" id="btn-unif-local">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="small-icon"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                            Keep Local
                        </button>
                    </div>
                </div>

                <div class="unification-footer">
                    <button class="secondary-action-btn" id="btn-unif-toggle-details">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toggle-icon"><path d="m6 9 6 6 6-6"/></svg>
                        <span>Show technical diff</span>
                    </button>
                    <div id="unif-diff-area" class="hidden">
                        <div class="diff-view" id="unif-diff-content"></div>
                    </div>
                </div>
            </div>
        `;

        div.querySelector("#btn-unif-local").onclick = () => this._handle("local");
        div.querySelector("#btn-unif-cloud").onclick = () => this._handle("cloud");
        div.querySelector("#btn-unif-latest").onclick = () => this._handle("latest");
        div.querySelector("#btn-unif-merge").onclick = () => this._handle("merge");
        div.querySelector("#btn-unif-close").onclick = () => this._handle("cancel");
        div.querySelector("#btn-unif-toggle-details").onclick = () => {
            const area = div.querySelector("#unif-diff-area");
            const btn = div.querySelector("#btn-unif-toggle-details");
            area.classList.toggle("hidden");
            
            const isHidden = area.classList.contains("hidden");
            btn.querySelector("span").innerText = isHidden ? "Show technical diff" : "Hide technical diff";
            btn.classList.toggle("active", !isHidden);
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
                fullDiff.unshift({ type: 'equal', val: oldLines[i - 1], lnOld: i, lnNew: j });
                i--; j--;
            } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
                fullDiff.unshift({ type: 'add', val: newLines[j - 1], lnNew: j });
                j--;
            } else {
                fullDiff.unshift({ type: 'remove', val: oldLines[i - 1], lnOld: i });
                i--;
            }
        }

        const contextLines = 2;
        const hunks = [];
        let currentHunk = null;

        fullDiff.forEach((line, idx) => {
            const isChanged = line.type !== 'equal';
            let shouldShow = isChanged;
            if (!shouldShow) {
                for (let k = 1; k <= contextLines; k++) {
                    if (fullDiff[idx - k]?.type && fullDiff[idx - k].type !== 'equal') shouldShow = true;
                    if (fullDiff[idx + k]?.type && fullDiff[idx + k].type !== 'equal') shouldShow = true;
                }
            }

            if (shouldShow) {
                if (!currentHunk) {
                    currentHunk = { lines: [] };
                    hunks.push(currentHunk);
                }
                currentHunk.lines.push(line);
            } else {
                currentHunk = null;
            }
        });

        return hunks.map((hunk) => {
            const startOld = hunk.lines.find(l => l.lnOld)?.lnOld || '..';
            const startNew = hunk.lines.find(l => l.lnNew)?.lnNew || '..';
            
            const linesHtml = hunk.lines.map(line => {
                const cls = line.type === 'add' ? 'add' : (line.type === 'remove' ? 'remove' : '');
                const prefix = line.type === 'add' ? '+' : (line.type === 'remove' ? '-' : ' ');
                const ln = line.type === 'add' ? line.lnNew : (line.type === 'remove' ? line.lnOld : line.lnNew);
                return `<div class="diff-line ${cls}"><span class="diff-ln">${ln}</span><span class="diff-prefix">${prefix}</span><span class="diff-content">${this._escapeHtml(line.val)}</span></div>`;
            }).join('');

            const header = `<div class="diff-hunk-header">@@ -${startOld} +${startNew} @@</div>`;
            return `<div class="diff-hunk-group">${header}${linesHtml}</div>`;
        }).join('');
    },

    _escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }
};
