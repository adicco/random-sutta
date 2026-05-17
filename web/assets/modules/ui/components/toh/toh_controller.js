// Path: web/assets/modules/ui/components/toh/toh_controller.js
import { ContentScanner } from './content_scanner.js';
import { DomRenderer } from './dom_renderer.js';
import { SuttaRepository } from 'data/sutta_repository.js';
import { getLogger } from 'core/logger.js';

const logger = getLogger("TOH");

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
    };

    if (!els.wrapper || !els.fab || !els.menu || !els.list || !els.container) {
        return { generate: () => {} };
    }

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

    // Binding Events
    els.fab.onclick = toggleMenu;

    els.menu.addEventListener("wheel", (e) => {
        // Find which content is active to check scroll
        const activeContent = els.contentHeadings.classList.contains('hidden') ? els.contentParallels : els.contentHeadings;
        if (!activeContent) return;

        const { scrollHeight, clientHeight, scrollTop } = activeContent;
        const isScrollable = scrollHeight > clientHeight;
        const delta = e.deltaY;

        if (!isScrollable) {
            e.preventDefault();
            return;
        }

        if (delta < 0 && scrollTop <= 0) {
            e.preventDefault();
            return;
        }

        if (delta > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
            e.preventDefault();
            return;
        }
        
        e.stopPropagation();
    }, { passive: false });

    let startY = 0;
    els.menu.addEventListener("touchstart", (e) => {
        startY = e.touches[0].pageY;
    }, { passive: true });

    els.menu.addEventListener("touchmove", (e) => {
        const activeContent = els.contentHeadings.classList.contains('hidden') ? els.contentParallels : els.contentHeadings;
        if (!activeContent) return;

        const { scrollHeight, clientHeight, scrollTop } = activeContent;
        const isScrollable = scrollHeight > clientHeight;
        const currentY = e.touches[0].pageY;
        const delta = startY - currentY; 

        if (!isScrollable) {
            if (e.cancelable) e.preventDefault();
            return;
        }

        if (delta < 0 && scrollTop <= 0) {
            if (e.cancelable) e.preventDefault();
            return;
        }

        if (delta > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
            if (e.cancelable) e.preventDefault();
            return;
        }
        e.stopPropagation();
    }, { passive: false });

    // Click outside to close
    document.addEventListener("click", (e) => {
        if (!els.menu.classList.contains("hidden") && !els.wrapper.contains(e.target)) {
            closeMenu();
        }
    });

    // --- Main Logic ---
    let observer = null;

    async function loadParallels(suttaId) {
        if (!els.parallelsList) return;
        els.parallelsList.innerHTML = '';
        
        if (!suttaId) {
            els.parallelsList.innerHTML = '<li class="toh-item"><div class="toh-header-row"><span class="toh-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels data available.</span></div></li>';
            return;
        }

        const parallelsData = await SuttaRepository.getParallels(suttaId);
        if (!parallelsData || Object.keys(parallelsData).length === 0) {
            els.parallelsList.innerHTML = '<li class="toh-item"><div class="toh-header-row"><span class="toh-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels found.</span></div></li>';
            return;
        }

        // Collect all target UIDs to fetch their titles
        const targetUids = new Set();
        Object.values(parallelsData).forEach(list => list.forEach(uid => targetUids.add(uid)));
        
        // Fetch metadata for titles
        const metadata = await SuttaRepository.getMetadata([...targetUids]);

        // Render sections in order
        const RELATION_ORDER = ["parallels", "resembles", "mentions", "retells"];
        let html = '';

        RELATION_ORDER.forEach(relType => {
            if (parallelsData[relType] && parallelsData[relType].length > 0) {
                // Formatting Title
                const sectionTitle = relType.charAt(0).toUpperCase() + relType.slice(1);
                
                html += `
                    <li class="toh-item" style="margin-top: 10px;">
                        <div class="toh-header-wrapper" style="border-bottom: 1px solid var(--border-light); padding-bottom: 4px; margin-bottom: 6px; padding-left: 15px; padding-right: 15px;">
                            <h4 class="toh-header" style="margin: 0; font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 1px;">${sectionTitle}</h4>
                        </div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                `;

                parallelsData[relType].forEach(uid => {
                    const meta = metadata[uid];
                    const acronym = meta ? meta.acronym : uid;
                    const title = meta ? (meta.translated_title || meta.original_title || "") : "";
                    
                    html += `
                        <li class="toh-item">
                            <div class="toh-header-row" onclick="window.router.navigate('/sutta/${uid}');" style="padding-left: 15px;">
                                <span class="toh-prefix" style="color: var(--primary-color);">${acronym}</span>
                                <span class="toh-main-text" style="font-weight: 500;">${title}</span>
                            </div>
                        </li>
                    `;
                });

                html += `</ul></li>`;
            }
        });

        els.parallelsList.innerHTML = html;
    }

    function generate(suttaId) {
        // Reset State
        els.list.innerHTML = "";
        closeMenu();
        if (observer) observer.disconnect();
        
        // Default to Headings tab
        switchTab('headings');

        // Load Parallels
        loadParallels(suttaId);

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