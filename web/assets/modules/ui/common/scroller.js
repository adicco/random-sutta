// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from 'utils/logger.js';
import { AppConfig } from 'core/app_config.js';
const logger = getLogger("Scroller");

// Offset context khi jump đến (trừ hao header)
const SCROLL_OFFSET_CTX = 60;
function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET_CTX;
}

function getReadingPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    
    const configVal = AppConfig.TTS?.SCROLL_OFFSET_TOP || '30vh';
    let offsetPx = 0;
    if (configVal.endsWith('vh')) {
        const percent = parseFloat(configVal) / 100;
        offsetPx = viewportHeight * percent;
    } else {
        offsetPx = parseFloat(configVal);
    }

    return currentScrollY + rectTop - offsetPx;
}

export const Scroller = {
    getScrollTop: function() {
        return window.scrollY || document.documentElement.scrollTop || 0;
    },

    restoreScrollTop: function(y) {
        return new Promise((resolve) => {
            if (typeof y !== 'number' || y < 0) {
                resolve();
                return;
            }
            
            let attempts = 0;
            const maxAttempts = 10;
            
            const attemptScroll = () => {
                const currentHeight = document.documentElement.scrollHeight;
                const viewportHeight = window.innerHeight;
                
                // Nếu chiều cao trang hiện tại chưa đủ để cuộn tới y, và chưa hết lượt thử
                if (currentHeight < y + viewportHeight && attempts < maxAttempts) {
                    attempts++;
                    setTimeout(() => requestAnimationFrame(attemptScroll), 100);
                    return;
                }

                document.documentElement.style.scrollBehavior = 'auto';
                window.scrollTo({ top: y, behavior: 'instant' });
                
                // Giữ fixed cho đến khi ổn định
                setTimeout(() => { 
                    document.documentElement.style.scrollBehavior = ''; 
                    resolve();
                }, 100);
            };

            // [OPTIMIZATION] If y=0, we don't need to wait as much for height calculation
            const initialDelay = (y === 0) ? 0 : 50;
            if (initialDelay === 0) {
                requestAnimationFrame(attemptScroll);
            } else {
                setTimeout(() => requestAnimationFrame(attemptScroll), initialDelay);
            }
        });
    },

    /**
     * [REFACTORED] Instant Jump (Teleport)
     */
    jumpTo: function(targetId) {
        if (!targetId) {
            this.restoreScrollTop(0);
            return;
        }
        // Force 'instant' behavior
        this._findAndScroll(targetId, getTargetPosition, 'instant');
    },

    /**
     * Smooth Scroll
     */
    smoothScrollTo: function(targetId) {
        if (!targetId) return;
        this._findAndScroll(targetId, getTargetPosition, 'smooth');
    },

    scrollToReadingPosition: function(target) {
        if (!target) return;
        this._findAndScroll(target, getReadingPosition, 'smooth');
    },

    scrollToId: function(targetId, behavior = 'instant') {
        if (behavior === 'smooth') {
            this.smoothScrollTo(targetId);
        } else {
            this.jumpTo(targetId);
        }
    },

    animateScrollTo: function(targetId) {
        this.smoothScrollTo(targetId);
    },

    highlightElement: function(targetId, autoRemove = false, endId = null, container = document) {
        if (!targetId) return;

        let retries = 0;
        const maxRetries = 40; // Approx 0.6s total

        const attemptHighlight = () => {
            // Support searching within a specific container to handle ID collisions in popups
            const startEl = container === document ? document.getElementById(targetId) : container.querySelector(`[id="${targetId}"]`);
            const endEl = endId ? (container === document ? document.getElementById(endId) : container.querySelector(`[id="${endId}"]`)) : null;

            if (!startEl || (endId && !endEl)) {
                if (retries < maxRetries) {
                    retries++;
                    requestAnimationFrame(attemptHighlight);
                } else if (startEl) {
                    this._executeHighlight(startEl, null, autoRemove, targetId, endId, container);
                }
                return;
            }

            this._executeHighlight(startEl, endEl, autoRemove, targetId, endId, container);
        };

        requestAnimationFrame(attemptHighlight);
    },

    _executeHighlight: function(startEl, endEl, autoRemove, targetId, endId, container = document) {
        container.querySelectorAll('.highlight, .highlight-container, .parent-highlight-bridge').forEach(e => {
            e.classList.remove('highlight', 'highlight-container', 'parent-highlight-bridge');
        });

        const allSegments = Array.from(container.querySelectorAll('.segment'));
        const startIndex = allSegments.findIndex(s => s.id === targetId || s.contains(startEl));
        let endIndex = endEl ? allSegments.findIndex(s => s.id === endId || s.contains(endEl)) : -1;

        if (startIndex !== -1) {
            let from = startIndex;
            let to = endIndex !== -1 ? endIndex : startIndex;
            if (from > to) [from, to] = [to, from];

            const highlightedParents = new Set();
            const BLOCK_TAGS = ['P', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'SECTION', 'LI'];

            for (let i = from; i <= to; i++) {
                const seg = allSegments[i];
                seg.classList.add('highlight');
                if (autoRemove) this._setupAutoRemove(seg, 'highlight');

                // [FIX] Walk up to find the closest block-level container
                let parent = seg.parentElement;
                while (parent && parent.tagName !== 'ARTICLE' && !BLOCK_TAGS.includes(parent.tagName)) {
                    parent = parent.parentElement;
                }
                
                if (parent && parent.tagName !== 'ARTICLE') {
                    highlightedParents.add(parent);
                }
            }

            highlightedParents.forEach(parent => {
                parent.classList.add('parent-highlight-bridge');
                if (autoRemove) this._setupAutoRemove(parent, 'parent-highlight-bridge');
            });

        } else {
            const el = startEl.classList.contains('anchor-ref') ? (startEl.closest('.segment') || startEl) : startEl;
            const highlightClass = el.classList.contains('segment') ? 'highlight' : 'highlight-container';
            el.classList.add(highlightClass);
            if (autoRemove) this._setupAutoRemove(el, highlightClass);
        }
    },

    _setupAutoRemove: function(el, className) {
        if (el.dataset.highlightTimer) {
            clearTimeout(parseInt(el.dataset.highlightTimer));
        }
        
        const timerId = setTimeout(() => {
            el.classList.remove(className);
            delete el.dataset.highlightTimer;
        }, 3500); 
        
        el.dataset.highlightTimer = timerId;
    },

    transitionTo: async function(renderAction, targetId) {
        if (renderAction) await renderAction();
        await new Promise(r => requestAnimationFrame(r));
        if (targetId) {
            this.smoothScrollTo(targetId);
            this.highlightElement(targetId);
        } else {
            this.restoreScrollTop(0);
        }
    },

    _findAndScroll(target, positionCalculator, behavior) {
        let retries = 0;
        const maxRetries = 60; // Approx 1s total

        const executeScroll = (element) => {
            const targetY = positionCalculator(element);
            
            if (behavior === 'instant') {
                document.documentElement.style.scrollBehavior = 'auto';
            }

            window.scrollTo({ top: targetY, behavior: behavior });

            if (behavior === 'instant') {
                setTimeout(() => {
                    document.documentElement.style.scrollBehavior = '';
                }, 50);
            }
        };

        // 1. Resolve Element directly or via ID
        let element = null;
        if (target instanceof HTMLElement) {
            element = target;
        } else if (typeof target === 'string') {
            element = document.getElementById(target);
        }

        // 2. Execute if found
        if (element) {
            executeScroll(element);
            return;
        }

        // 3. Async Retry Fallback (Only for string IDs)
        if (typeof target === 'string') {
            const attemptFind = () => {
                const el = document.getElementById(target);
                if (el) {
                    executeScroll(el);
                } else {
                    retries++;
                    if (retries < maxRetries) {
                        requestAnimationFrame(attemptFind);
                    } else {
                        logger.warn("Find", `Target not found after retries: ${target}`);
                    }
                }
            };
            requestAnimationFrame(attemptFind);
        }
    }
};