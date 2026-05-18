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

    async function generate(suttaId) {
        // Reset State
        els.list.innerHTML = "";
        closeMenu();
        
        // Hide FAB initially while loading
        els.fab.classList.add("hidden");
        
        // Load Parallels
        const hasData = await ParallelsData.load(suttaId, els.list);
        
        if (hasData) {
            // Show panel wrapper and fab
            els.wrapper.classList.remove("hidden");
            els.fab.classList.remove("hidden");
        } else {
            // Keep fab hidden if no data, ensure wrapper is also somewhat clean or hidden if needed
            els.wrapper.classList.remove("hidden"); // keeping wrapper as before, just hiding the fab
        }
    }

    return { generate };
}