// Path: web/assets/modules/ui/components/toh/toh_controller.js
import { ContentScanner } from './content_scanner.js';
import { DomRenderer } from './dom_renderer.js';
import { SuttaRepository } from 'data/sutta_repository.js';
import { getLogger } from 'utils/logger.js';

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
        resizeHandle: document.getElementById("toh-resize-handle")
    };

    if (!els.wrapper || !els.fab || !els.menu || !els.list || !els.container) {
        return { generate: () => {} };
    }

    // --- Resize Logic ---
    const _enableResize = (menu, handle) => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        const startResize = (clientX, clientY) => {
            isResizing = true;
            startX = clientX;
            startY = clientY;
            startWidth = menu.offsetWidth;
            startHeight = menu.offsetHeight;
            
            menu.style.transition = "none";
            document.body.style.cursor = "nesw-resize";
            document.body.style.userSelect = "none";
        };

        const doResize = (clientX, clientY) => {
            if (!isResizing) return;
            
            // Left drag increases width (startX - clientX)
            const newWidth = startWidth + (startX - clientX);
            const newHeight = startHeight + (clientY - startY);
            
            const maxWidth = window.innerWidth - 40; // 40px padding from edges
            const finalWidth = Math.min(Math.max(280, newWidth), maxWidth);
            menu.style.width = `${finalWidth}px`;
            
            const maxHeight = window.innerHeight - 80;
            const finalHeight = Math.min(Math.max(200, newHeight), maxHeight);
            menu.style.height = `${finalHeight}px`;
            menu.style.maxHeight = "none"; // Override CSS max-height during resize
        };

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;
            menu.style.transition = "";
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            
            // Optional: Save dimensions to localStorage if needed
        };

        handle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            startResize(e.clientX, e.clientY);
            
            const onMouseMove = (moveEvent) => {
                doResize(moveEvent.clientX, moveEvent.clientY);
            };
            
            const onMouseUp = () => {
                stopResize();
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };
            
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        handle.addEventListener("touchstart", (e) => {
            startResize(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        document.addEventListener("touchmove", (e) => {
            if (isResizing) {
                // Prevent scrolling while resizing
                if (e.cancelable) e.preventDefault(); 
                doResize(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        document.addEventListener("touchend", () => {
            stopResize();
        });
    };

    if (els.resizeHandle) {
        _enableResize(els.menu, els.resizeHandle);
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

        // Collect all target UIDs (stripping segment IDs) to fetch their titles
        const targetUids = new Set();
        Object.values(parallelsData).forEach(segmentData => {
            Object.values(segmentData).forEach(list => {
                list.forEach(target => {
                    const cleanUid = target.split('#')[0];
                    targetUids.add(cleanUid);
                });
            });
        });
        
        // Fetch metadata for titles
        const metadata = await SuttaRepository.fetchMetaList([...targetUids]);

        // Render sections in order
        const RELATION_ORDER = ["parallels", "resembles", "mentions", "retells"];
        let html = '';

        // Helper to format a link
        const createLinkHtml = (target) => {
            const cleanUid = target.split('#')[0];
            const segmentSuffix = target.includes('#') ? `#${target.split('#')[1]}` : '';
            
            const meta = metadata[cleanUid];
            const acronym = meta ? meta.acronym : cleanUid;
            const title = meta ? (meta.translated_title || meta.original_title || "") : "";
            
            return `
                <li class="toh-item">
                    <a class="toh-parallel-link" onclick="window.loadSutta('${target}'); return false;">
                        <span class="toh-parallel-acronym">${acronym}${segmentSuffix}</span>
                        <span class="toh-parallel-title">${title}</span>
                    </a>
                </li>
            `;
        };

        // 1. Render Sutta-level relations first (key == suttaId)
        if (parallelsData[suttaId]) {
            RELATION_ORDER.forEach(relType => {
                if (parallelsData[suttaId][relType] && parallelsData[suttaId][relType].length > 0) {
                    const sectionTitle = relType.charAt(0).toUpperCase() + relType.slice(1);
                    html += `
                        <li class="toh-item" style="margin-top: 10px;">
                            <h4 class="toh-group-header">${sectionTitle}</h4>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                    `;
                    parallelsData[suttaId][relType].forEach(target => {
                        html += createLinkHtml(target);
                    });
                    html += `</ul></li>`;
                }
            });
        }

        // 2. Render Segment-level relations
        const segmentKeys = Object.keys(parallelsData).filter(k => k !== suttaId);
        // Sort segment keys (e.g. by order if numeric, otherwise alphabetical)
        segmentKeys.sort((a, b) => {
            const aNum = parseFloat(a.split('#')[1]);
            const bNum = parseFloat(b.split('#')[1]);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.localeCompare(b);
        });

        if (segmentKeys.length > 0) {
            html += `
                <li class="toh-item" style="margin-top: 20px;">
                    <h4 class="toh-group-header" style="color: var(--primary-color);">By Segment</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">
            `;
            
            segmentKeys.forEach(segKey => {
                const segLabel = segKey.split('#')[1] || segKey;
                const elementId = segKey.replace('#', ':'); // Match HTML segment ID format (e.g. dn1:1.6.3)
                
                html += `
                    <li class="toh-item toh-segment-group">
                        <div class="toh-segment-header" onclick="document.getElementById('${elementId}')?.scrollIntoView({behavior: 'smooth', block: 'center'})" title="Jump to segment">Seg ${segLabel}</div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                `;
                
                RELATION_ORDER.forEach(relType => {
                    if (parallelsData[segKey][relType] && parallelsData[segKey][relType].length > 0) {
                         html += `<div class="toh-parallel-type-label">${relType}</div>`;
                         parallelsData[segKey][relType].forEach(target => {
                            html += createLinkHtml(target);
                        });
                    }
                });
                
                html += `</ul></li>`;
            });
            html += `</ul></li>`;
        }

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