// Path: web/assets/modules/ui/components/toh/toh_controller.js
import { ContentScanner } from './content_scanner.js';
import { DomRenderer } from './dom_renderer.js';
import { TohParallels } from './toh_parallels.js';
import { TohResize } from './toh_resize.js';
import { TohScroll } from './toh_scroll.js';

export function setupTableOfHeadings() {
    const els = {
        wrapper: document.getElementById("toh-wrapper"),
        fab: document.getElementById("toh-fab"),
        menu: document.getElementById("toh-menu"),
        list: document.getElementById("toh-list"),
        parallelsList: document.getElementById("parallels-list"),
        container: document.getElementById("sutta-container"),
        // Tabs
        tabHeadings: document.getElementById("tab-toh-headings"),
        tabParallels: document.getElementById("tab-toh-parallels"),
        contentHeadings: document.getElementById("toh-content-headings"),
        contentParallels: document.getElementById("toh-content-parallels"),
        resizeHandle: document.getElementById("toh-resize-handle")
    };

    if (!els.wrapper || !els.fab || !els.menu || !els.list || !els.container) {
        return { generate: () => {} };
    }

    // --- Resize Logic ---
    TohResize.enable(els.menu, els.resizeHandle);

    // --- Tab Logic ---
    const switchTab = (tabName) => {
        if (tabName === 'headings') {
            els.tabHeadings.classList.add("active");
            els.tabParallels.classList.remove("active");
            els.contentHeadings.classList.remove("hidden");
            els.contentParallels.classList.add("hidden");
        } else if (tabName === 'parallels') {
            els.tabParallels.classList.add("active");
            els.tabHeadings.classList.remove("active");
            els.contentParallels.classList.remove("hidden");
            els.contentHeadings.classList.add("hidden");
        }
    };

    if (els.tabHeadings && els.tabParallels) {
        els.tabHeadings.addEventListener('click', (e) => {
            e.stopPropagation();
            switchTab('headings');
        });
        els.tabParallels.addEventListener('click', (e) => {
            e.stopPropagation();
            switchTab('parallels');
        });
    }

    // --- Event Handlers ---
    const closeMenu = () => {
        els.menu.classList.add("hidden");
        els.fab.classList.remove("active");
    };

    const toggleMenu = (e) => {
        const isOpening = els.menu.classList.contains("hidden");
        els.menu.classList.toggle("hidden");
        els.fab.classList.toggle("active");
        e.stopPropagation();

        if (isOpening) {
            setTimeout(() => {
                const activeItem = els.list.querySelector(".active");
                if (activeItem) {
                    activeItem.scrollIntoView({ block: "center", behavior: "instant" });
                }
            }, 0);
        }
    };

    els.fab.onclick = toggleMenu;

    // --- Scroll Isolation ---
    const getActiveContent = () => els.contentHeadings.classList.contains('hidden') ? els.contentParallels : els.contentHeadings;
    TohScroll.enableIsolation(els.menu, getActiveContent);

    // Click outside to close
    document.addEventListener("click", (e) => {
        if (!els.menu.classList.contains("hidden") && !els.wrapper.contains(e.target)) {
            closeMenu();
        }
    });

    // --- Main Logic ---
    let observer = null;

    function generate(suttaId) {
        // Reset State
        els.list.innerHTML = "";
        closeMenu();
        if (observer) observer.disconnect();
        
        // Default to Headings tab
        switchTab('headings');

        // Load Parallels
        TohParallels.load(suttaId, els.parallelsList);

        // 1. Scan Data
        const scanResult = ContentScanner.scan(els.container);

        // 2. Render & Display
        if (scanResult.mode === 'none') {
            els.wrapper.classList.remove("hidden"); 
            els.menu.classList.remove("toh-mode-paragraphs");
        } else {
            DomRenderer.renderList(scanResult.items, els.list, {
                onItemClick: closeMenu
            });

            els.wrapper.classList.remove("hidden");
            
            if (scanResult.mode === 'paragraphs') {
                els.menu.classList.add("toh-mode-paragraphs");
            } else {
                els.menu.classList.remove("toh-mode-paragraphs");
            }

            const idsToTrack = [];
            scanResult.items.forEach(item => {
                if (item.id) idsToTrack.push(item.id);
                if (item.subTexts) {
                    item.subTexts.forEach(sub => {
                        if (sub.id) idsToTrack.push(sub.id);
                    });
                }
            });

            if (idsToTrack.length > 0) {
                observer = new IntersectionObserver((entries) => {
                    const visibleEntries = entries.filter(e => e.isIntersecting);
                    if (visibleEntries.length > 0) {
                        visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                        const topMostTarget = visibleEntries[0];
                        DomRenderer.updateActiveState(topMostTarget.target.id);
                    }
                }, {
                    rootMargin: '-5% 0px -85% 0px', 
                    threshold: 0
                });

                idsToTrack.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) observer.observe(el);
                });
            }
        }
    }

    return { generate };
}