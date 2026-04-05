// Path: web/assets/modules/core/sutta_controller.js
import { SuttaService } from "services/sutta_service.js";
import { RandomBuffer } from "services/random_buffer.js";
import { renderSutta } from "ui/views/renderer.js";
import { Router } from "core/router.js";
import { FilterComponent } from "ui/components/filters/index.js";
import { initPopupSystem } from "ui/components/popup/index.js";
import { Scroller } from "ui/common/scroller.js";
import { getLogger } from "utils/logger.js";
import { TTSOrchestrator } from "tts/core/tts_orchestrator.js";

const logger = getLogger("SuttaController");
const PopupAPI = initPopupSystem();

export const SuttaController = {
  isRestoring: false, // [NEW] Guard flag

  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    const isInitialRestore = scrollY > 0 && !isTransition;
    
    if (isInitialRestore) this.isRestoring = true;

    const currentScroll = Scroller.getScrollTop();
    const container = document.getElementById("sutta-container");

    // 1. Update URL State
    if (shouldUpdateUrl) {
        try {
            const bookParam = FilterComponent.generateBookParam();
            Router.updateURL(null, bookParam, false, null, currentScroll);
        } catch (e) {}
    }

    // 2. Hide Popups
    PopupAPI.hideAll();

    // 3. Handle TTS
    const wasTTSActive = TTSOrchestrator.isSessionActive();
    const wasPlaying = TTSOrchestrator.isPlaying();
    TTSOrchestrator.stop();
    if (!wasTTSActive) {
        TTSOrchestrator.endSession();
    }

    // 4. Parse Input
    let suttaId;
    let scrollTarget = null;
    if (typeof input === 'object') {
        suttaId = input.uid;
    } else {
        const parts = input.split('#');
        suttaId = parts[0].trim().toLowerCase();
        if (parts.length > 1) {
            scrollTarget = parts[1];
        }
    }

    if (scrollTarget && !scrollTarget.includes(':')) {
        const isSegmentNumber = /^[\d\.]+$/.test(scrollTarget);
        if (isSegmentNumber) {
            scrollTarget = `${suttaId}:${scrollTarget}`;
        }
    }

    logger.info('loadSutta', `Request: ${suttaId} (URL update: ${shouldUpdateUrl})`);
    logger.timer(`Render: ${suttaId}`);

    const performRender = async () => {
        // A. Fetch data (Mất thời gian, chưa cần ẩn ở đây để tránh nháy trắng)
        const result = await SuttaService.loadSutta(suttaId);
        
        if (!result) {
            renderSutta(suttaId, null, null, options);
            logger.timerEnd(`Render: ${suttaId}`);
            return false;
        }

        if (result.isAlias) {
            let redirectId = result.targetUid;
            if (result.hashId) redirectId += `#${result.hashId}`;
            this.loadSutta(redirectId, true, 0, { transition: false });
            logger.timerEnd(`Render: ${suttaId}`);
            return true;
        }
        
        // B. [TELEPORT STEP 1] Stealth Mode ACTIVATED
        // Chỉ ẩn nếu chúng ta định Jump (có target và không transition)
        // Ẩn NGAY TRƯỚC KHI render HTML mới
        const isTeleporting = !isTransition && scrollTarget && container;
        if (isTeleporting) {
            // Dùng visibility: hidden thay vì opacity để đảm bảo không thấy gì cả
            // nhưng vẫn giữ layout để Scroller tính toán được vị trí.
            container.style.visibility = 'hidden';
            
            // Tạm thời tắt smooth scroll global để đảm bảo
            document.documentElement.style.scrollBehavior = 'auto';
        }

        // C. Render Content (Thao tác DOM nặng nhất)
        // Lúc này container đang hidden, người dùng không thấy nội dung chèn vào ở đầu trang.
        const success = await renderSutta(suttaId, result, options);
        
        if (success) {
            PopupAPI.scan();
            if (!shouldUpdateUrl) {
                logger.debug("SuttaController", "Triggering popup restore...");
                PopupAPI.restore();
            }
            if (wasTTSActive) {
                setTimeout(() => {
                    TTSOrchestrator.refreshSession(wasPlaying);
                }, 100);
            }
        }

        if (success && shouldUpdateUrl) {
             const bookParam = FilterComponent.generateBookParam();
             Router.updateURL(suttaId, bookParam, false, scrollTarget ? `#${scrollTarget}` : null, currentScroll);
             this._saveProgress(suttaId, currentScroll);
        }
        
        logger.timerEnd(`Render: ${suttaId}`);
        return success;
    };

    // Execute Scroll/Transition Strategy
    if (isTransition) {
        await Scroller.transitionTo(performRender, scrollTarget);
    } else {
        await performRender();
        
        if (scrollTarget) {
            // [TELEPORT STEP 2] Instant Jump Synchronously
            // DOM đã có, container đang hidden. Jump ngay lập tức.
            Scroller.jumpTo(scrollTarget);
            Scroller.highlightElement(scrollTarget);
            this._saveProgress(suttaId, Scroller.getScrollTop());

            // [TELEPORT STEP 3] Reveal
            if (container) {
                // Sử dụng double requestAnimationFrame để đảm bảo jump đã render xong trong buffer
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        container.style.visibility = '';
                        // Cleanup styles
                        setTimeout(() => {
                            document.documentElement.style.scrollBehavior = '';
                        }, 50);
                    });
                });
            }
        } else if (scrollY > 0) {
            // Restore scroll position (Back button)
            Scroller.restoreScrollTop(scrollY);
            // Reveal ngay nếu container bị ẩn (từ logic trên)
            if (container) container.style.visibility = '';
        } else {
            // Top of page
            Scroller.restoreScrollTop(0);
            if (container) container.style.visibility = '';
        }
    }
    
    // Final save after all scrolls are done
    // If we are restoring a specific scroll position, use it.
    // Otherwise, let it read from DOM.
    this._saveProgress(suttaId, (scrollY > 0 && !scrollTarget) ? scrollY : undefined);
    
    // Clear guard after a short delay to allow UI to settle
    if (this.isRestoring) {
        setTimeout(() => { this.isRestoring = false; }, 500);
    }
  },

  /**
   * [NEW] Save current reading progress to localStorage
   */
  _saveProgress: function (id, scrollY) {
    if (this.isRestoring && scrollY === undefined) {
        logger.debug("Progress", "Save skipped: Restoration in progress");
        return;
    }
    
    try {
        const params = new URLSearchParams(window.location.search);
        const suttaId = id || params.get("q");
        if (!suttaId) return;

        const currentScroll = (scrollY !== undefined) ? scrollY : Scroller.getScrollTop();
        
        const progress = {
            id: suttaId,
            scrollY: currentScroll,
            timestamp: Date.now()
        };
        
        localStorage.setItem("last_read_sutta", JSON.stringify(progress));
        logger.debug("Progress", `Saved: ${suttaId} at ${currentScroll}`);
    } catch (e) {
        console.warn("Could not save progress:", e);
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    PopupAPI.hideAll();
    logger.timer('Random Process Total');

    const filters = FilterComponent.getActiveFilters();
    const payload = await RandomBuffer.getPayload(filters);
    if (!payload) {
      alert("Database loading or no suttas found.");
      logger.timerEnd('Random Process Total');
      return;
    }
    
    logger.info('loadRandom', `Selected: ${payload.uid}`);
    await this.loadSutta(payload, shouldUpdateUrl, 0, { transition: false });
    logger.timerEnd('Random Process Total');
  }
};