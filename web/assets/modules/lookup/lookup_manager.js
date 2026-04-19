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
            onNavigate: (dir) => LookupNavigator.navigate(dir, this._performLookup.bind(this))
        });
        
        // Initialize Dictionaries
        DictProvider.init().then(success => {
             if (success) logger.info("Init", "Dictionaries ready.");
        });
        
        // Click Event (Delegated)
        document.addEventListener("click", (e) => 
            LookupEventHandler.handleClick(e, this._performLookup.bind(this))
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
        // [UPDATED] Include all smart quotes
        const cleanText = text.toLowerCase().replace(/[.,;:"'‘’“”\—?!()…]/g, '').trim();
        
        if (cleanText.length > 50 || cleanText.length < 1) return; 
        
        // Ensure Dictionaries are ready
        const isReady = await DictProvider.init();
        if (!isReady) return;
        
        // Search
        let results = await DictProvider.search(cleanText, contextNode);
        
        // [DECONSTRUCTION] Auto-lookup components
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
                            const cleanPart = p.trim().toLowerCase().replace(/[.,;:"'‘’“”\—?!()…]/g, '');
                            // Avoid looking up the same word or very short words (optional)
                            if (cleanPart && cleanPart !== cleanText && cleanPart.length > 1) {
                                componentWords.add(cleanPart);
                            }
                        });
                    });
                });

                if (componentWords.size > 0) {
                    const extraPromises = Array.from(componentWords).map(word => DictProvider.search(word, contextNode));
                    const extraResultsArrays = await Promise.all(extraPromises);
                    
                    const seenIds = new Set(results.map(r => `${r.lookup_type}_${r.target_id}`));
                    for (const resArray of extraResultsArrays) {
                        for (const r of resArray) {
                            const id = `${r.lookup_type}_${r.target_id}`;
                            if (!seenIds.has(id)) {
                                seenIds.add(id);
                                results.push(r);
                            }
                        }
                    }
                }
            }
        }

        if (results && results.length > 0) {
            const renderData = PaliRenderer.renderList(results, cleanText);
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
            // Only show error if explicitly navigating or clicking, maybe?
            // Current behavior: show error in popup if popup is open or navigating
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