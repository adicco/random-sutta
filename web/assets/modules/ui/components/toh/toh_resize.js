// Path: web/assets/modules/ui/components/toh/toh_resize.js
export const TohResize = {
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

    _loadSavedDimensions(menu) {
        if (!menu) return;
        try {
            const key = `toh_menu_size${this._getDeviceSuffix()}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                const { width, height } = JSON.parse(saved);
                
                if (width) {
                    const wVal = parseInt(width);
                    if (wVal < window.innerWidth - 20) {
                        menu.style.width = width;
                    }
                }
                
                if (height) {
                    const hVal = parseInt(height);
                    const maxHeight = window.innerHeight - 50;
                    if (hVal < maxHeight) {
                        menu.style.height = height;
                        menu.style.maxHeight = "none";
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to load TOH dimensions", e);
        }
    },

    enable(menu, handle) {
        if (!menu || !handle) return;
        
        this._loadSavedDimensions(menu);

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

            // Save to localStorage with device suffix
            try {
                const size = {
                    width: menu.style.width,
                    height: menu.style.height
                };
                const key = `toh_menu_size${this._getDeviceSuffix()}`;
                localStorage.setItem(key, JSON.stringify(size));
            } catch(e) {}
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
    }
};