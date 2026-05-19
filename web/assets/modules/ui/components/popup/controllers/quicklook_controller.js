// Path: web/assets/modules/ui/components/popup/controllers/quicklook_controller.js
import { PopupState } from '../state/popup_state.js';
import { QuicklookUI } from '../ui/quicklook_ui.js';
import { CommentUI } from '../ui/comment_ui.js';
import { NavigationController } from './navigation_controller.js';
import { SuttaService } from 'services/sutta_service.js';
import { LeafRenderer } from 'ui/views/renderers/leaf_renderer.js';
import { getLogger } from 'utils/logger.js';

import { ZIndexManager } from 'ui/common/z_index_manager.js';

const logger = getLogger("QuicklookCtrl");
const SCROLL_OFFSET = 60;

export const QuicklookController = {
    init() {
        QuicklookUI.init({
            onClose: () => {
                QuicklookUI.hide();
                if (PopupState.activeIndex !== -1) {
                    PopupState.activeType = 'comment';
                    PopupState.activeUrl = null;
                } else {
                    window.dispatchEvent(new CustomEvent('popup:close-all', { detail: { skipParallels: true } }));
                }
            },
            onDeepLink: (href) => {
                NavigationController.handleFullPageNavigation(href, () => window.dispatchEvent(new CustomEvent('popup:close-all', { detail: { skipSnapshot: true } })));
            },
            onOpenOriginal: (href) => {
                NavigationController.handleFullPageNavigation(href, () => window.dispatchEvent(new CustomEvent('popup:close-all', { detail: { skipSnapshot: true } })));
            },
            onCommentClick: (text) => {
                this.openNestedComment(text);
            }
        });
    },

    openNestedComment(text) {
        // 1. Scan markers specifically inside Quicklook content
        const qlContent = QuicklookUI.elements.content;
        if (!qlContent) return;

        const markers = Array.from(qlContent.querySelectorAll(".comment-marker"));
        const index = markers.findIndex(m => m.dataset.comment === text);

        if (index !== -1) {
            // Store nested state
            PopupState.nestedActiveIndex = index;
            PopupState.nestedActiveText = text;

            // Activate Comment UI with this content
            // We use a helper to render without affecting the main 'activeIndex' in PopupState if possible,
            // but for simplicity, let's just render. 
            // NOTE: This will overlay the existing comment popup if one is open.
            CommentUI.render(text, index, markers.length, "Note from Preview");

            // [CRITICAL] Manage stacking: Comment must be above Quicklook
            const commentEl = document.getElementById("comment-popup");
            if (commentEl) ZIndexManager.bringToFront(commentEl);
        }
    },

    async handleLinkRequest(href, isRestoring = false) {
        const parsed = NavigationController.parseUrl(href);
        if (!parsed) return;
        const { uid, hash } = parsed;

        if (PopupState.loadingUid === uid) return;
        PopupState.loadingUid = uid;
        
        // Provide visual feedback if loading takes more than 150ms to prevent flickering
        // Skip delay if restoring to prevent flash
        let loadingTimer = null;
        if (isRestoring) {
            QuicklookUI.showLoading(uid.toUpperCase(), true);
        } else {
            loadingTimer = setTimeout(() => {
                QuicklookUI.showLoading(uid.toUpperCase());
            }, 150);
        }

        try {
            const data = await SuttaService.loadSutta(uid, { prefetchNav: false });
            if (loadingTimer) clearTimeout(loadingTimer);
            if (data && data.content) {
                const renderRes = LeafRenderer.render(data);
                const displayTitle = this._buildTitle(data.meta, uid);

                // 1. Render HTML vào DOM ngay lập tức
                QuicklookUI.render(renderRes.html, displayTitle, href, isRestoring);                
                // Update State
                PopupState.setQuicklookActive(href);
                
                if (hash) {
                    // 2. Gọi hàm cuộn ĐỒNG BỘ (Synchronous) ngay lập tức
                    // Không dùng setTimeout, không dùng opacity hack
                    this._scrollToAnchorSync(hash, uid);
                }
            } else {
                QuicklookUI.showError("Content not available.");
            }
        } catch (e) {
            clearTimeout(loadingTimer);
            logger.error("Load", e);
            QuicklookUI.showError("Failed to load.");
        } finally {
            PopupState.loadingUid = null;
        }
    },

    _scrollToAnchorSync(hash, uid) {
        // Xử lý ID mục tiêu
        let targetId = hash.substring(1);
        if (targetId && !targetId.includes(':') && /^[\d\.]+$/.test(targetId)) {
            targetId = `${uid}:${targetId}`;
        }

        const qBody = QuicklookUI.elements.popupBody;
        if (!qBody) return;

        // [TELEPORT CORE]
        // Vì chúng ta vừa gọi .innerHTML = ... ở dòng trên, trình duyệt chưa Paint.
        // Ta truy vấn DOM ngay lập tức để lấy phần tử mục tiêu.
        const targetEl = qBody.querySelector(`[id="${targetId}"]`);

        if (targetEl) {
            // Highlight ngay lập tức
            qBody.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
            targetEl.classList.add('highlight');

            // Tính toán vị trí tương đối
            // Việc gọi offsetTop sẽ ép trình duyệt tính toán Layout (Reflow) ngay lập tức, nhưng CHƯA Paint.
            // Offset này tương đối với offsetParent (chính là qBody nếu nó có position relative/fixed/absolute)
            // Nếu cấu trúc HTML phức tạp, dùng getBoundingClientRect an toàn hơn.
            
            // Cách 1: Dùng offsetTop (Nhanh nhất nếu cấu trúc đơn giản)
            // const targetTop = targetEl.offsetTop;
            // qBody.scrollTop = targetTop - SCROLL_OFFSET;

            // Cách 2: Dùng getBoundingClientRect (Chính xác nhất)
            // Lưu ý: Lúc này scrollTop có thể đang là 0
            const containerRect = qBody.getBoundingClientRect();
            const elementRect = targetEl.getBoundingClientRect();
            
            // Tính toán vị trí cần cuộn tới
            // scrollTop hiện tại + (khoảng cách từ đỉnh element tới đỉnh container) - offset
            const currentScroll = qBody.scrollTop;
            const targetPosition = currentScroll + (elementRect.top - containerRect.top) - SCROLL_OFFSET;

            // Gán trực tiếp scrollTop. 
            // Trình duyệt sẽ Paint frame đầu tiên tại vị trí này.
            qBody.scrollTop = targetPosition;
        }
    },

    _buildTitle(meta, uid) {
        meta = meta || {};
        const acronym = meta.acronym || uid.toUpperCase();
        const title = meta.translated_title || meta.original_title || "";
        if (title) return `<span class="ql-uid-badge">${acronym}</span><span class="ql-sutta-title">${title}</span>`;
        return `<span class="ql-uid-badge">${acronym}</span>`;
    }
};