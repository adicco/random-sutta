// Path: web/assets/modules/ui/managers/drawer_manager.js
import { PopupState } from 'ui/components/popup/state/popup_state.js';

export const DrawerManager = {
    init() {
        const toggleDrawerBtn = document.getElementById("btn-toggle-settings");
        const settingDrawer = document.getElementById("setting-drawer");
        
        const autoSwitchTopBtn = document.getElementById("btn-auto-switch-top");
        const autoSwitchBottomBtn = document.getElementById("btn-auto-switch-bottom");

        if (toggleDrawerBtn && settingDrawer) {
            // 1. Toggle Button Click
            toggleDrawerBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Ngăn sự kiện nổi lên document
                settingDrawer.classList.toggle("hidden");
                toggleDrawerBtn.classList.toggle("open");
                
                // [NEW] Sync UI state when opening
                if (autoSwitchTopBtn) {
                    autoSwitchTopBtn.textContent = `${PopupState.autoSwitchThresholdTop}%`;
                }
                if (autoSwitchBottomBtn) {
                    autoSwitchBottomBtn.textContent = `${PopupState.autoSwitchThresholdBottom}%`;
                }
            });

            // 2. Auto-Switch Threshold Cycle (Click to cycle)
            if (autoSwitchTopBtn) {
                autoSwitchTopBtn.addEventListener("click", () => {
                    const current = PopupState.autoSwitchThresholdTop;
                    // Cycle: 0 -> 10 -> 20 -> 30 -> 40 -> 0
                    let next = (current + 10) % 50;
                    autoSwitchTopBtn.textContent = `${next}%`;
                    PopupState.setAutoSwitchThresholdTop(next);
                });
            }

            if (autoSwitchBottomBtn) {
                autoSwitchBottomBtn.addEventListener("click", () => {
                    const current = PopupState.autoSwitchThresholdBottom;
                    // Cycle: 0 -> 20 -> 40 -> 60 -> 80 -> 0
                    let next = (current + 20) % 100;
                    autoSwitchBottomBtn.textContent = `${next}%`;
                    PopupState.setAutoSwitchThresholdBottom(next);
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