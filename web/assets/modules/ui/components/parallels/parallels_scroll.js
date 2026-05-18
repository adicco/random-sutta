// Path: web/assets/modules/ui/components/parallels/parallels_scroll.js
export const ParallelsScroll = {
    enableIsolation(menu, getActiveContentFn) {
        if (!menu) return;

        menu.addEventListener("wheel", (e) => {
            const activeContent = getActiveContentFn();
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
        menu.addEventListener("touchstart", (e) => {
            startY = e.touches[0].pageY;
        }, { passive: true });

        menu.addEventListener("touchmove", (e) => {
            const activeContent = getActiveContentFn();
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
    }
};