// Path: web/assets/modules/lookup/ui/lookup_ui.js
import { SwipeHandler } from 'ui/common/swipe_handler.js';
import { ScrollHandler } from 'ui/common/scroll_handler.js';
import { ZIndexManager } from 'ui/common/z_index_manager.js';
import { LookupState } from '../core/lookup_state.js';

export const LookupUI = {
    elements: {},

    init(callbacks = {}) {
        this.elements = {
            popup: document.getElementById("lookup-popup"),
            
            // Header & Controls
            closeBtn: document.getElementById("close-lookup"),
            wordHeading: document.getElementById("lookup-word-heading"),
            btnHistoryBack: document.getElementById("btn-lookup-back"),
            btnHistoryForward: document.getElementById("btn-lookup-forward"),
            tabDpd: document.getElementById("tab-dpd"),
            
            // Content
            bestMatchesContainer: document.getElementById("lookup-best-matches"),
            popupBody: document.querySelector("#lookup-popup .popup-body"),
            contentDpd: document.getElementById("lookup-content-dpd"),

            // Nav
            btnPrev: document.getElementById("btn-lookup-prev"),
            btnNext: document.getElementById("btn-lookup-next"),
            navInfo: document.getElementById("lookup-nav-info")
        };

        if (!this.elements.popup) return;

        // [Z-INDEX] Manage stacking order
        ZIndexManager.register(this.elements.popup);
        
        // [SCROLL LOCK] Prevent Mouse/Trackpad scroll chaining
        ScrollHandler.preventBackgroundScroll(this.elements.popup, this.elements.popupBody);

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.hide();
            if (callbacks.onClose) callbacks.onClose();
        });

        // History Controls
        if (this.elements.btnHistoryBack) {
            this.elements.btnHistoryBack.addEventListener("click", (e) => {
                e.stopPropagation();
                if (callbacks.onBack) callbacks.onBack();
            });
        }
        if (this.elements.btnHistoryForward) {
            this.elements.btnHistoryForward.addEventListener("click", (e) => {
                e.stopPropagation();
                if (callbacks.onForward) callbacks.onForward();
            });
        }
        if (this.elements.tabDpd) {
            this.elements.tabDpd.addEventListener("click", (e) => {
                e.stopPropagation();
                if (callbacks.onGoHome) callbacks.onGoHome();
            });
        }
        
        // Prevent clicks inside popup from closing it
        this.elements.popup.addEventListener("click", (e) => {
             e.stopPropagation();
        });

        // Prevent focus loss when clicking summaries OR TABS
        this.elements.popup.addEventListener("mousedown", (e) => {
            if (e.target.closest("summary") || e.target.closest(".lookup-tab") || e.target.closest(".lookup-history-btn")) {
                e.preventDefault();
            }
        });
        
        // Navigation
        if (this.elements.btnPrev) {
            this.elements.btnPrev.addEventListener("click", (e) => {
                e.stopPropagation();
                this.elements.btnPrev.blur(); // [UX] Remove focus to restore low-profile
                if (callbacks.onNavigate) callbacks.onNavigate(-1);
            });
        }
        if (this.elements.btnNext) {
            this.elements.btnNext.addEventListener("click", (e) => {
                e.stopPropagation();
                this.elements.btnNext.blur(); // [UX] Remove focus to restore low-profile
                if (callbacks.onNavigate) callbacks.onNavigate(1);
            });
        }

        // Swipe Gestures (Shared Handler)
        SwipeHandler.attach(this.elements.popup, {
            onSwipeLeft: () => { if (callbacks.onNavigate) callbacks.onNavigate(1); },
            onSwipeRight: () => { if (callbacks.onNavigate) callbacks.onNavigate(-1); },
            onVerticalScroll: (e) => {
                 // [FIX] Prevent scroll propagation if content is short (not scrollable)
                 if (this.elements.popupBody) {
                     const isScrollable = this.elements.popupBody.scrollHeight > this.elements.popupBody.clientHeight;
                     if (!isScrollable && e.cancelable) {
                         e.preventDefault();
                     }
                 }
            }
        });
    },

    render(data, titleWord = "Lookup", segmentText = "", rawResults = [], clickOffset = -1) {
        let dictHtml = "";

        // Handle both simple string (loading/error) and object (results)
        if (typeof data === 'string') {
            dictHtml = data;
        } else {
            dictHtml = data.dictHtml || "";
        }

        // 1. Best Matches Logic (Context Aware)
        if (this.elements.bestMatchesContainer) {
            this.elements.bestMatchesContainer.innerHTML = "";
            this.elements.bestMatchesContainer.classList.add("hidden");

            // Only proceed if we have segment context and raw results
            if (segmentText && rawResults && Array.isArray(rawResults) && rawResults.length > 0) {
                // Normalize segment text for loose matching
                // [UPDATED] Logic aligned with src/dict_builder/tools/text_scanner.py
                // 1. Normalize Niggahita
                let normSegment = segmentText.replace(/ṁ/g, 'ṃ').replace(/Ṁ/g, 'Ṃ');
                // 2. Remove quotes (Sandhi handling: join words like sāsanan”ti -> sāsananti)
                normSegment = normSegment.replace(/['‘’“”""]/g, '');
                // 3. Replace other punctuation with space
                normSegment = normSegment.toLowerCase().replace(/[.,;:\—?!()…\-–]/g, ' ');
                
                const cleanTitle = titleWord.toLowerCase().replace(/ṁ/g, 'ṃ').trim();

                const bestMatches = rawResults.filter(r => {
                    // [UPDATED] Prefer headword_clean if available (it has digits removed)
                    const headword = r.headword_clean || r.headword || r.lookup_key || "";
                    if (!headword) return false;

                    // Apply same cleaning to headword
                    let cleanHead = headword.replace(/ṁ/g, 'ṃ').replace(/['‘’“”""]/g, '');
                    cleanHead = cleanHead.toLowerCase().replace(/[.,;:\—?!()…\-–]/g, ' ').trim();

                    // 1. Must check equality first (Exact match exclusion)
                    if (cleanHead === cleanTitle) return false;

                    // 2. The result must CONTAIN the lookup word (Context Suggestion implies expanding on the word)
                    // e.g. Lookup "bhadante" -> Suggest "bhadante ti"
                    if (!cleanHead.includes(cleanTitle)) return false;

                    // 3. Check if phrase exists in segment
                    
                    // [NEW] Precise Overlap Check
                    // If we have the click location and it's a phrase, check if the clicked word is part of this phrase instance
                    if (clickOffset >= 0 && cleanHead.includes(" ")) {
                        const words = cleanHead.split(" ");
                        const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                        // Allow non-word chars between words (e.g. "atha, kho")
                        const pattern = `(${escapedWords.join('[\\W]+')})`; 
                        const regex = new RegExp(pattern, 'gi');
                        
                        let match;
                        while ((match = regex.exec(segmentText)) !== null) {
                             const start = match.index;
                             const end = start + match[0].length;
                             // Check overlap: clickOffset must be inside the matched range
                             if (clickOffset >= start && clickOffset < end) {
                                 return true;
                             }
                        }
                        return false; // Phrase found elsewhere but not here
                    }

                    // Fallback to loose check
                    const escapedHead = cleanHead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`(^|\\s)${escapedHead}(\\s|$)`, 'i');
                    return regex.test(normSegment);
                });

                if (bestMatches.length > 0) {
                    this.elements.bestMatchesContainer.classList.remove("hidden");
                    
                    bestMatches.forEach(match => {
                        const div = document.createElement("div");
                        div.className = "best-match-item";
                        
                        // Highlight: Underline the lookup word inside the phrase
                        const phrase = match.headword || match.lookup_key;
                        // Escape titleWord for regex safety just in case
                        const safeTitle = titleWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(${safeTitle})`, 'gi');
                        const highlightedPhrase = phrase.replace(regex, '<u>$1</u>');
                        
                        let html = `<div class="best-match-phrase">${highlightedPhrase}</div>`;
                        if (match.meaning) {
                            html += `<span class="best-match-meaning">${match.meaning}</span>`;
                        }
                        div.innerHTML = html;
                        this.elements.bestMatchesContainer.appendChild(div);
                    });
                }
            }
        }

        // 2. Set Title (Heading Row)
        if (this.elements.wordHeading) this.elements.wordHeading.textContent = titleWord;

        // 2.1 Update History Button States
        if (this.elements.btnHistoryBack) {
            this.elements.btnHistoryBack.disabled = (LookupState.history.length === 0);
        }
        if (this.elements.btnHistoryForward) {
            this.elements.btnHistoryForward.disabled = (LookupState.forwardStack.length === 0);
        }

        // 3. Render DPD Content
        if (this.elements.contentDpd) this.elements.contentDpd.innerHTML = dictHtml;

        // [Z-INDEX] Bring to front
        ZIndexManager.bringToFront(this.elements.popup);

        this.elements.popup.classList.remove("hidden");
        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;
    },
    
    updateNavInfo(text) {
        if (this.elements.navInfo) this.elements.navInfo.textContent = text;
    },

    showLoading(title = "Searching...") {
        this.render('<div style="text-align:center; padding: 20px;">Searching...</div>', title);
    },

    showError(msg, title = "Error") {
        this.render(`<p class="error-message">${msg}</p>`, title);
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
        if (this.elements.contentDpd) this.elements.contentDpd.innerHTML = "";
    },
    
    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    }
};