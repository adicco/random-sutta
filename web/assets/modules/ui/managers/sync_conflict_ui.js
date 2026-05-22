// Path: web/assets/modules/ui/managers/sync_conflict_ui.js
import { getLogger } from "utils/logger.js";

const logger = getLogger("SyncConflictUI");

export const SyncConflictUI = {
    _onResolve: null,

    show(localData, cloudData, onResolve) {
        this._onResolve = onResolve;
        
        // Create modal if not exists
        let modal = document.getElementById("sync-conflict-modal");
        if (!modal) {
            modal = this._createModal();
            document.body.appendChild(modal);
        }

        const localStr = JSON.stringify(localData.payload, null, 2);
        const cloudStr = JSON.stringify(cloudData.payload, null, 2);

        document.getElementById("conf-local-diff").textContent = localStr;
        document.getElementById("conf-cloud-diff").textContent = cloudStr;
        document.getElementById("conf-cloud-time").textContent = new Date(cloudData.timestamp).toLocaleString();
        document.getElementById("conf-local-time").textContent = new Date(localData.timestamp).toLocaleString();

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
                <h3>⚠️ Sync Conflict Detected</h3>
                <p>Data on GitHub has changed since your last sync. Please choose how to proceed:</p>
                
                <div class="diff-container">
                    <div class="diff-panel">
                        <h4>Local (This Device)</h4>
                        <div class="time-stamp" id="conf-local-time"></div>
                        <pre id="conf-local-diff"></pre>
                    </div>
                    <div class="diff-panel">
                        <h4>Cloud (GitHub)</h4>
                        <div class="time-stamp" id="conf-cloud-time"></div>
                        <pre id="conf-cloud-diff"></pre>
                    </div>
                </div>

                <div class="conflict-actions">
                    <button class="text-btn resolve-btn" id="btn-conf-local">Keep Local</button>
                    <button class="text-btn resolve-btn" id="btn-conf-cloud">Use Cloud</button>
                    <button class="text-btn resolve-btn primary" id="btn-conf-merge">Smart Merge</button>
                </div>
            </div>
            <style>
                .sync-conflict-modal { z-index: 10000; position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; padding: 20px; }
                .conflict-content { background: var(--bg-paper); border: 1px solid var(--border-color); padding: 24px; border-radius: 12px; max-width: 90%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
                .diff-container { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; overflow-y: auto; flex-grow: 1; }
                .diff-panel { border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; min-height: 200px; }
                .diff-panel pre { font-family: monospace; font-size: 11px; white-space: pre-wrap; overflow-x: auto; background: var(--bg-main); padding: 8px; border-radius: 4px; flex-grow: 1; margin: 8px 0; }
                .conflict-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }
                .resolve-btn { padding: 10px 20px; }
                .time-stamp { font-size: 12px; color: var(--text-muted); }
            </style>
        `;

        div.querySelector("#btn-conf-local").onclick = () => this._handle("local");
        div.querySelector("#btn-conf-cloud").onclick = () => this._handle("cloud");
        div.querySelector("#btn-conf-merge").onclick = () => this._handle("merge");

        return div;
    },

    _handle(choice) {
        this.hide();
        if (this._onResolve) this._onResolve(choice);
    }
};
