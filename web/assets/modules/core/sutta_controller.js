// Path: web/assets/modules/core/sutta_controller.js
import { SuttaService } from "services/sutta_service.js";
import { RandomBuffer } from "services/random_buffer.js";
import { renderSutta } from "ui/views/renderer.js";
import { Router } from "core/router.js";
import { FilterComponent } from "ui/components/filters/index.js";
import { PopupAPI } from "ui/components/popup/index.js";
import { Scroller } from "ui/common/scroller.js";
import { getLogger } from "utils/logger.js";
import { TTSOrchestrator } from "tts/core/tts_orchestrator.js";
import { BookmarkManager } from "ui/managers/bookmark_manager.js";

const logger = getLogger("SuttaController");

export const SuttaController = {
  isRestoring: false, // [NEW] Guard flag
  currentNav: { prev: null, next: null }, // [NEW] Track navigation IDs

  navigatePrev: function() {
    if (this.currentNav.prev) {
        this.loadSutta(this.currentNav.prev);
        return true;
    }
    return false;
  },

  navigateNext: function() {
    if (this.currentNav.next) {
        this.loadSutta(this.currentNav.next);
        return true;
    }
    return false;
  },

  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    this._showLoader(true);
    
    try {
        const isTransition = options.transition === true;
        const isInitialRestore = scrollY > 0 && !isTransition;
        
        if (isInitialRestore) this.isRestoring = true;

        const currentScroll = Scroller.getScrollTop();
        const container = document.getElementById("sutta-container");

        // [NEW] Check for pre-fetched data object (from Buffer)
        let preFetchedData = null;
        let suttaId;
        let scrollTarget = null;

        if (typeof input === 'object' && input.payload && input.data) {
            // Input is a buffered object { payload, data }
            preFetchedData = input.data;
            suttaId = input.payload.uid;
        } else if (typeof input === 'object') {
            suttaId = input.uid;
        } else {
            const parts = input.split('#');
            suttaId = parts[0].trim().toLowerCase();
            if (parts.length > 1) {
                scrollTarget = parts[1];
            }
        }

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

        if (scrollTarget && !scrollTarget.includes(':')) {
            const isSegmentNumber = /^[\d\.]+$/.test(scrollTarget);
            if (isSegmentNumber) {
                scrollTarget = `${suttaId}:${scrollTarget}`;
            }
        }

        logger.info('loadSutta', `Request: ${suttaId} (URL update: ${shouldUpdateUrl}, Cached: ${!!preFetchedData})`);
        logger.timer(`Render: ${suttaId}`);

        const performRender = async () => {
            // A. Fetch data
            const startFetch = performance.now();
            const result = preFetchedData || await SuttaService.loadSutta(suttaId);
            const endFetch = performance.now();
            logger.debug('loadSutta', `Data Fetch/Logic: ${(endFetch - startFetch).toFixed(2)}ms`);
            
            if (!result) {
                this.currentNav = { prev: null, next: null }; // Clear nav on error
                renderSutta(suttaId, null, null, options);
                logger.timerEnd(`Render: ${suttaId}`);
                return false;
            }

            // [NEW] Update Navigation State
            if (result.nav) {
                this.currentNav = { prev: result.nav.prev, next: result.nav.next };
            } else {
                this.currentNav = { prev: null, next: null };
            }

            if (result.isAlias) {
                let redirectId = result.targetUid;
                if (result.hashId) redirectId += `#${result.hashId}`;
                // We return here, let the recursive call handle its own loader visibility
                await this.loadSutta(redirectId, true, 0, { transition: false });
                logger.timerEnd(`Render: ${suttaId}`);
                return true;
            }
            
            // B. [TELEPORT STEP 1] Stealth Mode
            const isTeleporting = !isTransition && scrollTarget && container;
            if (isTeleporting) {
                container.style.visibility = 'hidden';
                document.documentElement.style.scrollBehavior = 'auto';
            }

            // C. Render Content
            const startRender = performance.now();
            const success = await renderSutta(suttaId, result, options);
            const endRender = performance.now();
            logger.debug('loadSutta', `DOM Rendering: ${(endRender - startRender).toFixed(2)}ms`);
            
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
        this._saveProgress(suttaId, (scrollY > 0 && !scrollTarget) ? scrollY : undefined);
        
        // Clear guard after a short delay to allow UI to settle
        if (this.isRestoring) {
            setTimeout(() => { this.isRestoring = false; }, 500);
        }
        
        // [NEW] Update Bookmark Star
        BookmarkManager.updateButtonState(suttaId);
    } catch (e) {
        logger.error("loadSutta", "Error loading sutta", e);
    } finally {
        this._showLoader(false);
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
        window.dispatchEvent(new CustomEvent("local-data-changed"));
        logger.debug("Progress", `Saved: ${suttaId} at ${currentScroll}`);
    } catch (e) {
        console.warn("Could not save progress:", e);
    }
  },

  _loaderTimer: null,

  _showLoader: function (show) {
    const loader = document.getElementById("sutta-loader");
    const btns = [
      document.getElementById("btn-random"),
      document.getElementById("btn-landing-random"),
      document.getElementById("nav-prev"),
      document.getElementById("nav-next")
    ];

    // Luôn khóa/mở khóa nút ngay lập tức để chặn spam
    btns.forEach(btn => {
      if (btn) btn.disabled = show;
    });

    if (show) {
      // Nếu yêu cầu hiện loader, đợi 200ms mới thực sự hiện UI
      // Điều này giúp tránh hiện tượng "nháy" khi data có sẵn trong buffer
      if (this._loaderTimer) clearTimeout(this._loaderTimer);
      this._loaderTimer = setTimeout(() => {
        if (loader) {
          loader.classList.remove("hidden");
          // Force reflow for CSS transition
          loader.offsetHeight;
          loader.classList.add("visible");
        }
      }, 200);
    } else {
      // Tắt loader ngay lập tức
      if (this._loaderTimer) {
        clearTimeout(this._loaderTimer);
        this._loaderTimer = null;
      }
      if (loader) {
        loader.classList.remove("visible");
        setTimeout(() => {
          if (!this._loaderTimer) loader.classList.add("hidden");
        }, 300);
      }
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    this._showLoader(true);

    try {
      PopupAPI.hideAll();
      logger.timer('Random Process Total');

      const filters = FilterComponent.getActiveFilters();
      const input = await RandomBuffer.getPayload(filters);

      // [FIXED] Kiểm tra uid linh hoạt cho cả cấu trúc cũ và mới (buffered)
      const isValid = input && (input.uid || (input.payload && input.payload.uid));

      if (!isValid) {
        logger.warn('Random Process Total', 'Payload empty');
        this._showLoader(false);
        return;
      }

      const suttaUid = input.uid || input.payload.uid;
      logger.info('loadRandom', `Selected: ${suttaUid}`);
      await this.loadSutta(input, shouldUpdateUrl, 0, { transition: false });

      logger.timerEnd('Random Process Total');
    } catch (e) {
      logger.error("Random", "Failed to load random sutta", e);
    } finally {
      this._showLoader(false);
    }
  }
  };