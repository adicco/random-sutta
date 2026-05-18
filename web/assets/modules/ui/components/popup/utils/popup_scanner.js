// Path: web/assets/modules/ui/components/popup/utils/popup_scanner.js
import { getCleanTextContent } from 'ui/components/magic_nav/text_utils.js';

export const PopupScanner = {
    scan(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];

        const markers = container.querySelectorAll(".comment-marker");
        return Array.from(markers).map(marker => ({
            id: marker.closest('.segment')?.id,
            text: marker.dataset.comment,
            element: marker.closest('.segment')
        }));
    },

    getContextText(comments, index) {
        if (index >= 0 && index < comments.length) {
            const el = comments[index].element;
            if (el) return getCleanTextContent(el);
        }
        return "";
    }
};