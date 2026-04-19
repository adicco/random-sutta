// Path: web/assets/modules/lookup/lookup_manager.js
import { DictProvider } from './dict_provider.js';
import { LookupUI } from './ui/lookup_ui.js';
import { PaliMainRenderer as PaliRenderer } from './renderers/pali/pali_main_renderer.js';
import { getLogger } from 'utils/logger.js';

import { LookupEventHandler } from './core/lookup_event_handler.js';
import { LookupNavigator } from './core/lookup_navigator.js';
import { LookupHighlighter } from './core/lookup_highlighter.js';
import { LookupState } from './core/lookup_state.js';

const logger = getLogger("LookupManager");

export const LookupManager = {
    init() {
        // UI Callbacks
        LookupUI.init({
            onClose: () => this.clearHighlight(),
            onNavigate: (dir) => LookupNavigator.navigate(dir, (text, node) => {
                LookupState.clearHistory(); // New navigation word = new history
                this._performLookup(text, node);
            }),
            onBack: () => this._navigateHistory(-1),
            onForward: () => this._navigateHistory(1),
            onGoHome: () => this._navigateHistory(0)
        });
        
        // Initialize Dictionaries
        DictProvider.init().then(success => {
             if (success) logger.info("Init", "Dictionaries ready.");
        });
        
        // Click Event (Delegated)
        document.addEventListener("click", (e) => 
            LookupEventHandler.handleClick(e, (text, node) => {
                LookupState.clearHistory(); // New click word = new history
                this._performLookup(text, node);
            })
        );
        
        // Keyboard Navigation
        document.addEventListener("keydown", (e) => {
            const lookupEl = document.getElementById("lookup-popup");
            if (LookupUI.isVisible() && lookupEl && lookupEl.classList.contains("is-top-layer")) {
                if (e.key === "ArrowLeft") LookupNavigator.navigate(-1, this._performLookup.bind(this));
                if (e.key === "ArrowRight") LookupNavigator.navigate(1, this._performLookup.bind(this));
            }
        });
        
        // Global Integration
        window.addEventListener('popup:close-all', () => {
            LookupUI.hide();
            document.body.classList.remove("lookup-open");
        });

        // Click inside popup (for construction items)
        const popup = document.getElementById("lookup-popup");
        if (popup) {
            popup.addEventListener("click", (e) => {
                const item = e.target.closest(".dpd-construction-item.clickable");
                if (item) {
                    const term = item.getAttribute("data-lookup");
                    if (term) {
                        e.stopPropagation();
                        // Trigger lookup for the construction item (parts)
                        this._performLookup(term, item);
                    }
                }
            });
        }
    },

    _navigateHistory(direction) {
        if (direction === 0) { // Go Home (First result)
            if (LookupState.history.length === 0) return;
            const home = LookupState.history[0];
            LookupState.clearHistory();
            this._updateLastState(home);
            LookupUI.render(home.renderData, home.title, home.segmentText, home.results, home.clickOffset);
            return;
        }

        if (direction === -1) { // Back
            const currentState = this._getCurrentUIState();
            const prevState = LookupState.popHistory();
            if (prevState) {
                LookupState.pushForward(currentState);
                this._updateLastState(prevState);
                LookupUI.render(prevState.renderData, prevState.title, prevState.segmentText, prevState.results, prevState.clickOffset);
            }
        } else if (direction === 1) { // Forward
            const currentState = this._getCurrentUIState();
            const nextState = LookupState.popForward();
            if (nextState) {
                LookupState.pushHistory(currentState);
                this._updateLastState(nextState);
                LookupUI.render(nextState.renderData, nextState.title, nextState.segmentText, nextState.results, nextState.clickOffset);
            }
        }
    },

    _updateLastState(state) {
        this._lastRenderData = state.renderData;
        this._lastTitle = state.title;
        this._lastSegmentText = state.segmentText;
        this._lastResults = state.results;
        this._lastClickOffset = state.clickOffset;
    },

    _getCurrentUIState() {
        return {
            renderData: this._lastRenderData,
            title: this._lastTitle,
            segmentText: this._lastSegmentText,
            results: this._lastResults,
            clickOffset: this._lastClickOffset
        };
    },

    async _performLookup(text, contextNode) {
        if (!text) return;
        
        // [CONTEXT] Capture Segment Text & Click Offset
        let segmentText = "";
        let clickOffset = -1;

        if (contextNode && contextNode.nodeType === 1) { // Ensure it's an element
            // Try to find the closest segment container
            const segment = contextNode.closest(".segment") || contextNode.closest("p") || contextNode.parentElement;
            if (segment) {
                segmentText = segment.textContent;
                
                // [UPDATED] Calculate Offset using Range (More robust)
                try {
                    const range = document.createRange();
                    range.selectNodeContents(segment);
                    range.setEndBefore(contextNode);
                    clickOffset = range.toString().length;
                } catch (e) {
                    logger.warn("Lookup", "Offset calc failed", e);
                }
            }
        }

        // Clean Text
        // [UPDATED] Include all smart quotes and normalize to NFC
        const cleanText = text.toLowerCase().normalize('NFC').replace(/[.,;:"'‘’“”\—?!()…]/g, '').trim();
        
        if (cleanText.length > 50 || cleanText.length < 1) return; 
        
        // Ensure Dictionaries are ready
        const isReady = await DictProvider.init();
        if (!isReady) return;
        
        // [COMPONENTS] Support construction lookup strings (e.g. "word1 + word2")
        const searchTerms = cleanText.includes('+') 
            ? cleanText.split('+').map(t => t.trim()).filter(t => t)
            : [cleanText];

        // Search
        let results = [];
        const seenIds = new Set();
        
        // Use loop to ensure sequential lookups (state safety for SQLite _lookup_params)
        for (const term of searchTerms) {
            const res = await DictProvider.search(term, contextNode);
            res.forEach(r => {
                // If searching for components, mark them as exact so they show up at top
                if (searchTerms.length > 1) r.is_exact = true;
                
                const id = `${r.lookup_type}_${r.target_id}`;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    results.push(r);
                } else if (searchTerms.length > 1) {
                    // Update existing to be exact if found via component
                    const existing = results.find(ex => `${ex.lookup_type}_${ex.target_id}` === id);
                    if (existing) existing.is_exact = true;
                }
            });
        }
        
        // [DECONSTRUCTION] Auto-lookup components for DECON results
        if (results && results.length > 0) {
            const decons = results.filter(r => r.is_deconstruction && r.meaning);
            if (decons.length > 0) {
                const componentWords = new Set();
                decons.forEach(d => {
                    // Split by ',' then by '+' as per pali_decon_renderer.js logic
                    const rows = d.meaning.split(',');
                    rows.forEach(row => {
                        const parts = row.split('+');
                        parts.forEach(p => {
                            // [UPDATED] Use NFC normalization for consistent matching with DB
                            const cleanPart = p.trim().toLowerCase().normalize('NFC').replace(/[.,;:"'‘’“”\—?!()…]/g, '');
                            // Avoid looking up the same word or very short words
                            if (cleanPart && cleanPart !== cleanText && cleanPart.length > 1) {
                                componentWords.add(cleanPart);
                            }
                        });
                    });
                });

                if (componentWords.size > 0) {
                    // [IMPORTANT] Sequential lookup to avoid SQLite state collision in _lookup_params
                    for (const word of componentWords) {
                        const resArray = await DictProvider.search(word, contextNode);
                        for (const r of resArray) {
                            // Ensure component matches are treated as exact matches in the final list
                            r.is_exact = true;
                            
                            const id = `${r.lookup_type}_${r.target_id}`;
                            const existing = results.find(ex => `${ex.lookup_type}_${ex.target_id}` === id);
                            if (!existing) {
                                results.push(r);
                            } else {
                                existing.is_exact = true;
                            }
                        }
                    }
                }
            }
        }

        // [HISTORY] If this lookup was triggered from INSIDE the popup, save previous state
        const isInternal = contextNode && (contextNode.closest("#lookup-popup") !== null);
        if (isInternal && this._lastTitle && this._lastTitle !== cleanText) {
            LookupState.pushHistory(this._getCurrentUIState());
        }

        if (results && results.length > 0) {
            const renderData = PaliRenderer.renderList(results, cleanText);
            
            // Store for History
            this._lastRenderData = renderData;
            this._lastTitle = cleanText;
            this._lastSegmentText = segmentText;
            this._lastResults = results;
            this._lastClickOffset = clickOffset;

            // Pass clickOffset to render
            LookupUI.render(renderData, cleanText, segmentText, results, clickOffset); 
            document.body.classList.add("lookup-open");

            // [STACKING] Bring to Front
            const lookupEl = document.getElementById("lookup-popup");
            const commentEl = document.getElementById("comment-popup");
            if (lookupEl) lookupEl.classList.add("is-top-layer");
            if (commentEl) commentEl.classList.remove("is-top-layer");
            
            // Auto Scroll (only if first look, not nav)
            if (!LookupState.isNavigating) {
                LookupHighlighter.scrollToElement(contextNode, true);
            }
        } else {
            // Not found
            if (LookupState.isNavigating || LookupUI.isVisible()) {
                LookupUI.showError(`"${cleanText}" not found.`, cleanText);
            }
        }
        
        // Reset Nav Flag
        LookupState.isNavigating = false;
    },
    
    clearHighlight() {
        LookupHighlighter.clearHighlight();
        document.body.classList.remove("lookup-open");
        
        // [STACKING] When closing, yield 'top-layer' status back to Comment if open
        const lookupEl = document.getElementById("lookup-popup");
        if (lookupEl) lookupEl.classList.remove("is-top-layer");

        const commentEl = document.getElementById("comment-popup");
        // Check if comment popup is visible (not hidden)
        if (commentEl && !commentEl.classList.contains("hidden")) {
            commentEl.classList.add("is-top-layer");
        }
    }
};