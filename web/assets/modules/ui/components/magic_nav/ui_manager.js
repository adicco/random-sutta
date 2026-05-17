// Path: web/assets/modules/ui/components/magic_nav/ui_manager.js
export const UIManager = {
    elements: {},

    init() {
        this.elements = {
            wrapper: document.getElementById("magic-nav-wrapper"),
            corner: document.getElementById("magic-nav-corner"),
            btnToc: document.getElementById("btn-magic-toc"),
            bar: document.getElementById("magic-breadcrumb-bar"),
            drawer: document.getElementById("magic-toc-drawer"),
            tocContent: document.getElementById("magic-toc-content"),
            bookmarksContent: document.getElementById("magic-bookmarks-content"),
            backdrop: document.getElementById("magic-backdrop"),
            resizeHandle: document.getElementById("magic-toc-resize-handle"),
        };

        this._loadSavedDimensions();

        if (this.elements.wrapper) {
            this.elements.wrapper.addEventListener("click", (e) => {
                // If collapsed, a click on the wrapper opens everything.
                if (this.elements.wrapper.classList.contains("collapsed")) {
                    this.openWrapper(); // This will now open wrapper AND breadcrumb
                    e.stopPropagation();
                }
                // If open, a click on the corner or the wrapper background closes everything.
                else {
                    const cornerClicked = this.elements.corner.contains(e.target);
                    const wrapperBgClicked = e.target === this.elements.wrapper;
                    if (cornerClicked || wrapperBgClicked) {
                        this.closeAll();
                        e.stopPropagation();
                    }
                }
            });

            if (this.elements.bar) {
                this._enableDragScroll(this.elements.bar);
            }
        }

        if (this.elements.backdrop) {
            this.elements.backdrop.addEventListener("click", () => this.closeAll());
        }

        if (this.elements.resizeHandle) {
            this._enableResize(this.elements.drawer, this.elements.resizeHandle);
        }

        return this.elements;
    },

    _getDeviceSuffix() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isTouch = window.matchMedia("(pointer: coarse)").matches;
        
        // Bucketed viewport sizing (100px steps)
        const bucketW = Math.floor(w / 100) * 100;
        const bucketH = Math.floor(h / 100) * 100;
        
        const isLandscape = w > h;
        return `_v${bucketW}x${bucketH}_${isLandscape ? 'L' : 'P'}${isTouch ? '_T' : ''}`;
    },

    _loadSavedDimensions() {
        const { drawer } = this.elements;
        if (!drawer) return;
        
        try {
            const key = `magic_drawer_size${this._getDeviceSuffix()}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                const { width, height } = JSON.parse(saved);
                
                // Validate width
                if (width) {
                    const wVal = parseInt(width);
                    if (wVal < window.innerWidth - 20) {
                        drawer.style.width = width;
                    }
                }
                
                // Validate height
                if (height) {
                    const hVal = parseInt(height);
                    const maxHeight = window.innerHeight - 70;
                    if (hVal < maxHeight + 50) {
                        drawer.style.height = height;
                        drawer.style.maxHeight = "95vh"; 
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to load drawer dimensions", e);
        }
    },

    _enableResize(drawer, handle) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        const startResize = (clientX, clientY) => {
            isResizing = true;
            startX = clientX;
            startY = clientY;
            startWidth = drawer.offsetWidth;
            startHeight = drawer.offsetHeight;
            
            drawer.style.transition = "none"; // Disable transition during resize
            document.body.style.cursor = "nwse-resize";
            document.body.style.userSelect = "none";
        };

        const doResize = (clientX, clientY) => {
            if (!isResizing) return;
            
            const newWidth = startWidth + (clientX - startX);
            const newHeight = startHeight + (clientY - startY);
            
            // Constrain width
            const maxWidth = window.innerWidth - 30;
            const finalWidth = Math.min(Math.max(280, newWidth), maxWidth);
            drawer.style.width = `${finalWidth}px`;
            drawer.style.maxWidth = "none"; // Override CSS max-width
            
            // Constrain height
            const maxHeight = window.innerHeight - 70;
            const finalHeight = Math.min(Math.max(200, newHeight), maxHeight);
            drawer.style.height = `${finalHeight}px`;
            drawer.style.maxHeight = "none"; // Override CSS max-height
        };

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;
            drawer.style.transition = "";
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            
            // Save to localStorage with device suffix
            const size = {
                width: drawer.style.width,
                height: drawer.style.height
            };
            const key = `magic_drawer_size${this._getDeviceSuffix()}`;
            localStorage.setItem(key, JSON.stringify(size));
        };

        // Mouse events
        handle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            startResize(e.clientX, e.clientY);
        });

        window.addEventListener("mousemove", (e) => doResize(e.clientX, e.clientY));
        window.addEventListener("mouseup", stopResize);

        // Touch events
        handle.addEventListener("touchstart", (e) => {
            if (e.touches.length > 0) {
                startResize(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        window.addEventListener("touchmove", (e) => {
            if (isResizing && e.touches.length > 0) {
                doResize(e.touches[0].clientX, e.touches[0].clientY);
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        window.addEventListener("touchend", stopResize);
    },

    // [NEW] Strict Scroll Isolation Helper
    _setupScrollIsolation(element) {
        // 1. Wheel Event (Mouse)
        element.addEventListener("wheel", (e) => {
            const { scrollHeight, clientHeight, scrollTop } = element;
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

        // 2. Touch Events (Mobile)
        let startY = 0;
        element.addEventListener("touchstart", (e) => {
            startY = e.touches[0].pageY;
        }, { passive: true });

        element.addEventListener("touchmove", (e) => {
            const { scrollHeight, clientHeight, scrollTop } = element;
            const isScrollable = scrollHeight > clientHeight;
            const currentY = e.touches[0].pageY;
            // Delta is inverted for touch (move up = scroll down)
            // But here we think in terms of content movement.
            // Finger moves UP (currentY < startY) -> Content scrolls DOWN (scrollTop increases)
            // Finger moves DOWN (currentY > startY) -> Content scrolls UP (scrollTop decreases)
            const delta = startY - currentY; 

            if (!isScrollable) {
                if (e.cancelable) e.preventDefault();
                return;
            }
            
            // Scrolling UP (Content moves down) -> Check Top
            if (delta < 0 && scrollTop <= 0) {
                 if (e.cancelable) e.preventDefault();
                 return;
            }
            
            // Scrolling DOWN (Content moves up) -> Check Bottom
            if (delta > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
                 if (e.cancelable) e.preventDefault();
                 return;
            }
            
            e.stopPropagation();
        }, { passive: false });
    },

    setHidden(isHidden) {
        if (this.elements.wrapper) {
            if (isHidden) {
                this.elements.wrapper.classList.add("hidden");
            } else {
                this.elements.wrapper.classList.remove("hidden");
                this.elements.wrapper.classList.add("collapsed");
            }
        }
    },

    updateContent(bcHtml, tocHtml) {
        if (this.elements.bar) this.elements.bar.innerHTML = bcHtml;
        if (this.elements.tocContent) this.elements.tocContent.innerHTML = tocHtml;
    },

    _enableDragScroll(slider) {
        let isDown = false;
        let startX;
        let scrollLeft;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.classList.add('active');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); });
        slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2; 
            slider.scrollLeft = scrollLeft - walk;
        });

        slider.addEventListener('touchstart', (e) => {
            isDown = true;
            startX = e.touches[0].pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        }, { passive: true });
        slider.addEventListener('touchend', () => { isDown = false; });

        slider.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            const x = e.touches[0].pageX - slider.offsetLeft;
            const walk = (x - startX) * 1.5; 
            slider.scrollLeft = scrollLeft - walk;
        }, { passive: true });

        slider.addEventListener("wheel", (e) => {
            if (e.shiftKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                if (slider.scrollWidth > slider.clientWidth) {
                    e.preventDefault();
                    slider.scrollLeft += e.deltaY;
                }
            }
        }, { passive: false });
    },

    openWrapper() {
        this.elements.wrapper.classList.remove("collapsed");

        // also expand breadcrumb
        const { bar, backdrop } = this.elements;
        this._closePopupsOnly(); // Ensure other popups are closed
        bar?.classList.add("expanded");
        backdrop?.classList.remove("hidden");
        this._scrollBreadcrumbToEnd();
    },

    closeAll() {
        const { bar, drawer, backdrop, btnToc, wrapper } = this.elements;
        bar?.classList.remove("expanded");
        drawer?.classList.remove("open");
        backdrop?.classList.add("hidden");
        btnToc?.classList.remove("active");
        wrapper?.classList.add("collapsed");
    },

    toggleBreadcrumb() {
        const { bar } = this.elements;
        const isExpanded = bar.classList.contains("expanded");
        this._closePopupsOnly(); 

        if (!isExpanded) {
            bar.classList.add("expanded");
            this.elements.backdrop.classList.remove("hidden");
            this._scrollBreadcrumbToEnd();
            return true;
        }
        this.elements.backdrop.classList.remove("hidden"); 
        return false;
    },

    toggleTOC() {
        const { drawer, backdrop, btnToc } = this.elements;
        const isOpen = drawer.classList.contains("open");

        // A simple toggle for the TOC drawer
        if (isOpen) {
            drawer.classList.remove("open");
            btnToc.classList.remove("active");
            // The backdrop is handled by other functions now, don't hide it here
            // as the breadcrumb bar might need it.
        } else {
            drawer.classList.add("open");
            btnToc.classList.add("active");
            backdrop.classList.remove("hidden"); // Ensure backdrop is visible
            this._scrollToActive();
        }
    },

    _closePopupsOnly() {
        const { bar, drawer, btnToc } = this.elements;
        bar?.classList.remove("expanded");
        drawer?.classList.remove("open");
        btnToc?.classList.remove("active");
    },

    isBreadcrumbExpanded() {
        return this.elements.bar?.classList.contains("expanded");
    },

    _scrollToActive() {
        setTimeout(() => {
            const { drawer } = this.elements;
            // [FIX] Update selector to target .toc-header-row.active for branches
            const activeItem = drawer?.querySelector(".toc-item.active") || drawer?.querySelector(".toc-header-row.active");
            if (activeItem) {
                activeItem.scrollIntoView({ block: "center", behavior: "instant" });
            }
        }, 0); 
    },

    _scrollBreadcrumbToEnd() {
        const endMarker = document.getElementById("magic-bc-end");
        if (endMarker) {
            endMarker.scrollIntoView({ behavior: "instant", inline: "end" });
        } else {
            setTimeout(() => {
                const bar = this.elements.bar;
                if (bar) bar.scrollLeft = bar.scrollWidth;
            }, 0);
        }
    }
};