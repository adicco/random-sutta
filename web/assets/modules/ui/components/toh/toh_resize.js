// Path: web/assets/modules/ui/components/toh/toh_resize.js
export const TohResize = {
    enable(menu, handle) {
        if (!menu || !handle) return;
        
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