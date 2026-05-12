// Path: web/assets/modules/ui/managers/drawer_manager.js
export const DrawerManager = {
    init() {
        const toggleDrawerBtn = document.getElementById("btn-toggle-settings");
        const settingDrawer = document.getElementById("setting-drawer");
    
        if (toggleDrawerBtn && settingDrawer) {
            // 1. Toggle Button Click
            toggleDrawerBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Ngăn sự kiện nổi lên document
                settingDrawer.classList.toggle("hidden");
                toggleDrawerBtn.classList.toggle("open");
            });

            // 2. Click Outside to Close
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