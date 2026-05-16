// Path: web/assets/modules/ui/components/toh/toh_controller.js
import { ContentScanner } from './content_scanner.js';
import { DomRenderer } from './dom_renderer.js';

export function setupTableOfHeadings() {
    const els = {
        wrapper: document.getElementById("toh-wrapper"),
        fab: document.getElementById("toh-fab"),
        menu: document.getElementById("toh-menu"),
        list: document.getElementById("toh-list"),
        container: document.getElementById("sutta-container"),
        header: document.querySelector("#toh-menu .toh-header")
    };

    if (!els.wrapper || !els.fab || !els.menu || !els.list || !els.container) {
        return { generate: () => {} };
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
            // Force scroll to active item when opening
            // Use setTimeout to ensure layout is updated after removing 'hidden'
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

    // [FIX] Strict Scroll Isolation: Prevent scroll chaining to body
    // This ensures that hovering the TOH and scrolling NEVER moves the main text
    els.menu.addEventListener("wheel", (e) => {
        const { scrollHeight, clientHeight, scrollTop } = els.menu;
        const isScrollable = scrollHeight > clientHeight;
        const delta = e.deltaY;

        // 1. If content fits entirely (not scrollable), block scroll completely
        if (!isScrollable) {
            e.preventDefault();
            return;
        }

        // 2. If at Top Boundary and trying to scroll UP -> Block
        if (delta < 0 && scrollTop <= 0) {
            e.preventDefault();
            return;
        }

        // 3. If at Bottom Boundary and trying to scroll DOWN -> Block
        // Use 1px buffer for float rounding differences
        if (delta > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
            e.preventDefault();
            return;
        }
        
        // Otherwise, allow internal scroll but stop propagation just in case
        e.stopPropagation();
    }, { passive: false });

    // [FIX] Mobile Touch Isolation
    let startY = 0;
    els.menu.addEventListener("touchstart", (e) => {
        startY = e.touches[0].pageY;
    }, { passive: true });

    els.menu.addEventListener("touchmove", (e) => {
        const { scrollHeight, clientHeight, scrollTop } = els.menu;
        const isScrollable = scrollHeight > clientHeight;
        const currentY = e.touches[0].pageY;
        const delta = startY - currentY; // Finger UP = Scroll DOWN (Positive Delta)

        if (!isScrollable) {
            if (e.cancelable) e.preventDefault();
            return;
        }

        // Scrolling UP (Content moves UP, Finger moves DOWN)
        if (delta < 0 && scrollTop <= 0) {
            if (e.cancelable) e.preventDefault();
            return;
        }

        // Scrolling DOWN (Content moves DOWN, Finger moves UP)
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

    function generate() {
        // Reset State
        els.list.innerHTML = "";
        closeMenu();
        if (observer) observer.disconnect();

        // 1. Scan Data (Sử dụng ContentScanner)
        const scanResult = ContentScanner.scan(els.container);

        // 2. Render & Display (Sử dụng DomRenderer)
        if (scanResult.mode === 'none') {
            // [FIXED] Không ẩn wrapper vì nó chứa nút Bookmark. 
            // Ta chỉ làm sạch list và cập nhật header mặc định.
            els.wrapper.classList.remove("hidden"); 
            els.header.textContent = "Sutta Tools"; 
            els.menu.classList.remove("toh-mode-paragraphs");
        } else {
            DomRenderer.updateHeader(scanResult.mode, els.header);
            
            DomRenderer.renderList(scanResult.items, els.list, {
                onItemClick: closeMenu
            });

            els.wrapper.classList.remove("hidden");
            
            // [NEW] Add mode class to menu for styling
            if (scanResult.mode === 'paragraphs') {
                els.menu.classList.add("toh-mode-paragraphs");
            } else {
                els.menu.classList.remove("toh-mode-paragraphs");
            }

            // [NEW] Active State Tracking
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
                    // [UPDATED LOGIC] Sắp xếp để tìm phần tử cao nhất
                    // 1. Lấy tất cả các phần tử đang giao nhau (visible)
                    const visibleEntries = entries.filter(e => e.isIntersecting);
                    
                    if (visibleEntries.length > 0) {
                        // 2. Sắp xếp theo vị trí top (nhỏ nhất -> cao nhất trên màn hình)
                        // Điều này đảm bảo ta luôn active đoạn văn đầu tiên trong vùng nhìn thấy
                        // thay vì một đoạn văn ngẫu nhiên ở giữa.
                        visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                        
                        const topMostTarget = visibleEntries[0];
                        DomRenderer.updateActiveState(topMostTarget.target.id);
                    }
                }, {
                    // [UPDATED MARGIN] Tạo một vùng "Scanner" hẹp ở phía trên màn hình.
                    // -5% top: Bỏ qua 5% trên cùng (tránh header che hoặc padding).
                    // -85% bottom: Loại bỏ 85% phía dưới màn hình.
                    // => Vùng kích hoạt (Active Zone) chỉ là dải 10% nằm sát phía trên.
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