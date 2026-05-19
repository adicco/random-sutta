// Path: web/assets/modules/core/sutta_controller.js
import { SuttaService } from "services/sutta_service.js";
import { SuttaRepository } from "data/sutta_repository.js";
import { RandomBuffer } from "services/random_buffer.js";
import { renderSutta } from "ui/views/renderer.js";
import { Router } from "core/router.js";
import { ViewManager } from "ui/managers/view_manager.js";
import { FilterComponent } from "ui/components/filters/index.js";
import { PopupAPI } from "ui/components/popup/index.js";
import { Scroller } from "ui/common/scroller.js";
import { getLogger } from "utils/logger.js";
import { TTSOrchestrator } from "tts/core/tts_orchestrator.js";
import { BookmarkManager } from "ui/managers/bookmark_manager.js";
import { DictProvider } from "lookup/dict_provider.js";

// [NEW] Sub-modules
import { SuttaLoaderUI } from "core/sutta/loader_ui.js";
import { SuttaPersistence } from "core/sutta/persistence.js";
import { SuttaNavigation } from "core/sutta/navigation.js";

const logger = getLogger("SuttaController");

export const SuttaController = {
  navigatePrev: function() {
    if (SuttaLoaderUI.isLoading) return false;
    const prevId = SuttaNavigation.getPrev();
    if (prevId) {
        this.loadSutta(prevId, true, 0, { transition: true });
        return true;
    }
    return false;
  },

  navigateNext: function() {
    if (SuttaLoaderUI.isLoading) return false;
    const nextId = SuttaNavigation.getNext();
    if (nextId) {
        this.loadSutta(nextId, true, 0, { transition: true });
        return true;
    }
    return false;
  },

  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    if (SuttaLoaderUI.isLoading && !options.force) return;
    SuttaLoaderUI.show();
    
    try {
        const isTransition = options.transition === true;
        const isInitialRestore = scrollY > 0 && !isTransition;
        
        if (isInitialRestore) SuttaPersistence.startRestoring();

        const currentScroll = Scroller.getScrollTop();
        const container = document.getElementById("sutta-container");

        let preFetchedData = null;
        let suttaId;
        let scrollTarget = null;
        let rangeEnd = null;

        // [NEW] Resolve Range from Options (e.g. from Router)
        if (options.hl) {
            const hlParts = options.hl.split('-');
            scrollTarget = hlParts[0];
            rangeEnd = hlParts[1] || null;
        }

        if (typeof input === 'object' && input.payload && input.data) {
            preFetchedData = input.data;
            suttaId = input.payload.uid;
        } else if (typeof input === 'object') {
            suttaId = input.uid;
        } else {
            const hashIndex = input.indexOf('#');
            if (hashIndex !== -1) {
                suttaId = input.substring(0, hashIndex).trim().toLowerCase();
                const hashContent = decodeURIComponent(input.substring(hashIndex + 1));
                
                // If not already set by hl option, parse from hash
                if (!scrollTarget) {
                    if (hashContent.includes('-')) {
                        // Split by '-' but handle if parts still have '#'
                        const rangeParts = hashContent.split('-');
                        scrollTarget = rangeParts[0].trim().replace(/^#/, '');
                        rangeEnd = rangeParts[1].trim().replace(/^#/, '') || null;
                    } else {
                        scrollTarget = hashContent.replace(/^#/, '');
                    }
                }
            } else {
                suttaId = input.trim().toLowerCase();
            }
        }

        // [NEW] Normalize immediately to avoid double URL updates
        scrollTarget = this._normalizeScrollTarget(suttaId, scrollTarget);
        rangeEnd = this._normalizeScrollTarget(suttaId, rangeEnd);

        // 1. Update URL State (Optional)
        if (shouldUpdateUrl) {
            try {
                const bookParam = FilterComponent.generateBookParam();
                // [UPDATED] Use hl param in URL
                const hlParam = rangeEnd ? `${scrollTarget}-${rangeEnd}` : scrollTarget;
                Router.updateURL(suttaId, bookParam, false, scrollTarget, currentScroll, { hl: hlParam });
            } catch (e) {}
        }

        // 2. Clear UI/State
        PopupAPI.hideAll(!shouldUpdateUrl);
        this._stopTTS();

        logger.info('loadSutta', `Request: ${suttaId} (URL: ${shouldUpdateUrl}, Buffered: ${!!preFetchedData})`);
        logger.timer(`Render: ${suttaId}`);

        const performRender = async () => {
            const result = preFetchedData || await SuttaService.loadSutta(suttaId);
            
            if (result && result.uid && result.uid !== suttaId && !result.isAlias && shouldUpdateUrl) {
                try {
                    const bookParam = FilterComponent.generateBookParam();
                    const hlParam = rangeEnd ? `${scrollTarget}-${rangeEnd}` : scrollTarget;
                    Router.updateURL(result.uid, bookParam, false, scrollTarget, Scroller.getScrollTop(), { replace: true, hl: hlParam });
                } catch (e) {}
            }

            if (!result) {
                return await this._handleMissingSutta(suttaId, options);
            }

            // Update Navigation State
            SuttaNavigation.update(result.nav);

            if (result.isAlias) {
                const fullHash = rangeEnd ? `${scrollTarget}-${rangeEnd}` : scrollTarget;
                return await this._handleAlias(result, fullHash);
            }
            
            // scrollTarget and rangeEnd already normalized above

            // Rendering
            const success = await renderSutta(suttaId, result, options);

            if (success) {
                this._handleSuccessfulRender(suttaId, scrollTarget, currentScroll, shouldUpdateUrl, rangeEnd);
            }

            logger.timerEnd(`Render: ${suttaId}`);
            return success;
        };

        // Execution Logic
        if (isTransition) {
            const status = await performRender();
            if (status === 'ALIAS_REDIRECTED') return;

            await new Promise(r => requestAnimationFrame(r));
            if (scrollTarget) {
                // Consistency delay
                setTimeout(() => {
                    Scroller.smoothScrollTo(scrollTarget);
                    Scroller.highlightElement(scrollTarget, false, rangeEnd);
                }, 50);
            } else {
                await Scroller.restoreScrollTop(0);
            }
        } else {
            const isBottomJump = options.fromBottom === true && Scroller.getScrollTop() > 300;
            if (isBottomJump && container) container.style.visibility = 'hidden';

            const status = await performRender();
            if (status === 'ALIAS_REDIRECTED') return;
            
            if (scrollTarget) {
                // [NEW] Balanced jump logic. 
                // We do one immediate attempt and one short-delayed attempt (for layout stability).
                const performJump = () => {
                    const el = document.getElementById(scrollTarget);
                    if (el) {
                        Scroller.jumpTo(scrollTarget);
                        Scroller.highlightElement(scrollTarget, false, rangeEnd);
                        SuttaPersistence.save(suttaId, Scroller.getScrollTop());
                    }
                };

                // Immediate attempt
                requestAnimationFrame(performJump);
                // Layout stability attempt (covers most browser reflows)
                setTimeout(performJump, 300); 
            } else if (scrollY > 0) {
                await Scroller.restoreScrollTop(scrollY);
            } else if (Scroller.getScrollTop() > 0) {
                await Scroller.restoreScrollTop(0);
            }

            if (isBottomJump && container) {
                requestAnimationFrame(() => requestAnimationFrame(() => { container.style.visibility = ''; }));
            }
        }

        SuttaPersistence.save(suttaId, (scrollY > 0 && !scrollTarget) ? scrollY : undefined);
        SuttaPersistence.endRestoring();
        
        BookmarkManager.updateButtonState(suttaId);
        this._initBackgroundTasks();

    } catch (e) {
        logger.error("loadSutta", "Error loading sutta", e);
    } finally {
        SuttaLoaderUI.hide();
        const container = document.getElementById("sutta-container");
        if (container && container.style.visibility === 'hidden') {
            container.style.visibility = '';
        }
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true, options = {}) {
    try {
      PopupAPI.hideAll();
      logger.timer('Random Process Total');

      const filters = FilterComponent.getActiveFilters();
      const input = await RandomBuffer.getPayload(filters);

      const isValid = input && (input.uid || (input.payload && input.payload.uid));
      if (!isValid) return;

      const suttaUid = input.uid || input.payload.uid;
      logger.info('loadRandom', `Selected: ${suttaUid}`);
      
      await this.loadSutta(input, shouldUpdateUrl, 0, { transition: false, ...options });

      logger.timerEnd('Random Process Total');
    } catch (e) {
      logger.error("Random", "Failed to load random sutta", e);
    }
  },

  // --- INTERNAL HELPERS ---

  _stopTTS: function() {
    const wasActive = TTSOrchestrator.isSessionActive();
    TTSOrchestrator.stop();
    if (!wasActive) TTSOrchestrator.endSession();
  },

  _handleMissingSutta: async function(suttaId, options) {
    const searchResults = await SuttaRepository.searchMetadata(suttaId, 1000);
    if (searchResults && searchResults.length > 0) {
        const searchData = {
            uid: suttaId,
            type: 'search_results',
            results: searchResults,
            query: suttaId,
            displayInfo: { uid: suttaId, title: `Search: ${suttaId}`, acronym: "Search" }
        };
        ViewManager.switchView('reader');
        await renderSutta(suttaId, searchData, options);
        logger.timerEnd(`Render: ${suttaId}`);
        return true;
    }
    SuttaNavigation.update(null);
    renderSutta(suttaId, null, null, options);
    logger.timerEnd(`Render: ${suttaId}`);
    return false;
  },

  _handleAlias: async function(result, scrollTarget) {
    let redirectId = result.targetUid;
    const finalHash = result.hashId || scrollTarget;
    if (finalHash) redirectId += `#${finalHash}`;
    await this.loadSutta(redirectId, true, 0, { transition: false, force: true });
    return 'ALIAS_REDIRECTED';
  },

  _normalizeScrollTarget: function(suttaId, scrollTarget) {
    if (scrollTarget && !scrollTarget.includes(':')) {
        const isSegmentNumber = /^[\d\.]+$/.test(scrollTarget);
        if (isSegmentNumber) return `${suttaId}:${scrollTarget}`;
    }
    return scrollTarget;
  },

  _handleSuccessfulRender: function(suttaId, scrollTarget, currentScroll, shouldUpdateUrl, rangeEnd = null) {
    PopupAPI.scan();
    if (!shouldUpdateUrl) PopupAPI.restore();
    
    if (TTSOrchestrator.isSessionActive()) {
        setTimeout(() => TTSOrchestrator.refreshSession(TTSOrchestrator.isPlaying()), 100);
    }

    if (shouldUpdateUrl) {
        const bookParam = FilterComponent.generateBookParam();
        const hlParam = rangeEnd ? `${scrollTarget}-${rangeEnd}` : (scrollTarget ? `${scrollTarget}` : null);
        // Use replace: true to update normalized URL without pushing a new history entry
        Router.updateURL(suttaId, bookParam, false, scrollTarget, currentScroll, { replace: true, hl: hlParam });
        SuttaPersistence.save(suttaId, currentScroll);
    }
  },

  _initBackgroundTasks: function() {
    if (window.requestIdleCallback) {
        window.requestIdleCallback(() => DictProvider.init(), { timeout: 2000 });
    } else {
        setTimeout(() => DictProvider.init(), 1000);
    }
  },

  _saveProgress: function() {
    SuttaPersistence.save();
  }
};
