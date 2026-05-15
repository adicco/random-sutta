// Path: web/assets/modules/ui/managers/drawer_manager.js
import { PopupState } from 'ui/components/popup/state/popup_state.js';

export const DrawerManager = {
    init() {
        const toggleDrawerBtn = document.getElementById("btn-toggle-settings");
        const settingDrawer = document.getElementById("setting-drawer");
        
        const autoSwitchInput = document.getElementById("input-auto-switch-threshold");
        const autoSwitchLabel = document.getElementById("label-auto-switch-threshold");

        if (toggleDrawerBtn && settingDrawer) {
            // 1. Toggle Button Click
            toggleDrawerBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Ngăn sự kiện nổi lên document
                settingDrawer.classList.toggle("hidden");
                toggleDrawerBtn.classList.toggle("open");
                
                // [NEW] Sync UI state when opening
                if (autoSwitchInput && autoSwitchLabel) {
                    const val = PopupState.autoSwitchThreshold;
                    autoSwitchInput.value = val;
                    autoSwitchLabel.textContent = `${val}%`;
                }
            });

            // 2. Auto-Switch Threshold Change
            if (autoSwitchInput && autoSwitchLabel) {
                autoSwitchInput.addEventListener("input", (e) => {
                    const val = parseInt(e.target.value);
                    autoSwitchLabel.textContent = `${val}%`;
                    PopupState.setAutoSwitchThreshold(val);
                });
            }

            // 3. Click Outside to Close
            document.addEventListener("click", (e) => {
                const isHidden = settingDrawer.classList.contains("hidden");
                
                // Nếu drawer đang mở, và click KHÔNG nằm trong drawer, KHÔNG nằm trong nút toggle
                if (!isHidden && 
                    !settingDrawer.contains(e.target) && 
                    !toggleDrawerBtn.contains(e.target)) {
                    
                    settingDrawer.classList.add("hidden");
                    toggleDrawerBtn.classList.remove("open");
                }
            });

            // Ngăn click bên trong drawer làm đóng drawer
            settingDrawer.addEventListener("click", (e) => {
                e.stopPropagation();
            });
        }
    }
};