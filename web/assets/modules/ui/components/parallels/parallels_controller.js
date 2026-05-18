// Path: web/assets/modules/ui/components/parallels/parallels_controller.js
import { ParallelsData } from './parallels_data.js';
import { ParallelsResize } from './parallels_resize.js';
import { ParallelsScroll } from './parallels_scroll.js';

export function setupParallelsPanel() {
    const els = {
        wrapper: document.getElementById("parallels-panel"),
        fab: document.getElementById("parallels-fab"),
        menu: document.getElementById("parallels-menu"),
        list: document.getElementById("parallels-list"),
        container: document.getElementById("sutta-container"),
        content: document.getElementById("parallels-content"),
        resizeHandle: document.getElementById("parallels-resize-handle")
    };

    if (!els.wrapper || !els.fab || !els.menu || !els.list) {
        return { generate: () => {} };
    }

    // --- Resize Logic ---
    ParallelsResize.enable(els.menu, els.resizeHandle);

    // --- Event Handlers ---
    const closeMenu = () => {
        els.menu.classList.add("hidden");
        els.fab.classList.remove("active");
    };

    const toggleMenu = (e) => {
        els.menu.classList.toggle("hidden");
        els.fab.classList.toggle("active");
        e.stopPropagation();
    };

    els.fab.onclick = toggleMenu;

    // --- Scroll Isolation ---
    ParallelsScroll.enableIsolation(els.menu, () => els.content);

    // Click outside to close
    document.addEventListener("click", (e) => {
        if (!els.menu.classList.contains("hidden") && !els.wrapper.contains(e.target)) {
            closeMenu();
        }
    });

    function generate(suttaId) {
        // Reset State
        els.list.innerHTML = "";
        closeMenu();
        
        // Load Parallels
        ParallelsData.load(suttaId, els.list);
        
        // Show panel
        els.wrapper.classList.remove("hidden");
    }

    return { generate };
}