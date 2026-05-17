// Path: web/assets/modules/lookup/core/lookup_navigator.js
import { LookupState } from './lookup_state.js';
import { LookupHighlighter } from './lookup_highlighter.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("LookupNavigator");

export const LookupNavigator = {
    navigate(direction, onLookupCallback) {
        let anchorNode = LookupState.getHighlightNode();
        
        if (!anchorNode) {
            // Fallback: Try finding by class if state is lost
            anchorNode = document.querySelector('.lookup-highlight');
            if (!anchorNode) return;
        }

        // If current highlight is hidden, jump segment immediately
        if (anchorNode.offsetParent === null) {
            this._jumpSegment(anchorNode, direction, onLookupCallback);
            return;
        }

        const parent = anchorNode.parentElement;
        const fullText = parent.textContent;
        
        // Find current token index
        const currentOffset = this._calculateOffset(parent, anchorNode);
        const currentWordLength = anchorNode.textContent.length;
        const currentCenter = currentOffset + (currentWordLength / 2);

        const tokens = this._tokenize(fullText);
        
        let currentIndex = -1;
        // Exact center match
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            const tokenCenter = (t.start + t.end) / 2;
            if (Math.abs(tokenCenter - currentCenter) < 2) {
                currentIndex = i;
                break;
            }
        }
        
        // Fallback: Closest match
        if (currentIndex === -1) {
             let minDist = Infinity;
             tokens.forEach((t, i) => {
                 const tokenCenter = (t.start + t.end) / 2;
                 const dist = Math.abs(tokenCenter - currentCenter);
                 if (dist < minDist) {
                     minDist = dist;
                     currentIndex = i;
                 }
             });
        }

        const nextIndex = currentIndex + direction;
        
        // Check Boundary (Jump Segment)
        if (nextIndex < 0) {
            this._jumpSegment(anchorNode, -1, onLookupCallback);
            return;
        } else if (nextIndex >= tokens.length) {
            this._jumpSegment(anchorNode, 1, onLookupCallback);
            return;
        }
        
        // Select New Token
        this._selectTokenInParent(parent, tokens[nextIndex], onLookupCallback);
    },

    _calculateOffset(parent, targetNode) {
        let offset = 0;
        for (const node of parent.childNodes) {
            if (node === targetNode) break;
            offset += node.textContent.length;
        }
        return offset;
    },

    _tokenize(text) {
        const regex = /[^\s—…]+/g;
        let match;
        const tokens = [];
        while ((match = regex.exec(text)) !== null) {
            tokens.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        return tokens;
    },

    _selectTokenInParent(parent, token, onLookupCallback) {
        LookupState.isNavigating = true;
        
        // 1. Clear existing highlights (Merges text nodes)
        LookupHighlighter.clearHighlight();
        
        // 2. Find text node covering [token.start, token.end]
        let currentPos = 0;
        let targetNode = null;
        let targetStart = 0;
        let targetEnd = 0;
        
        for (const node of parent.childNodes) {
            const len = node.textContent.length;
            if (currentPos + len > token.start) {
                if (node.nodeType === 3) {
                    targetNode = node;
                    targetStart = token.start - currentPos;
                    targetEnd = token.end - currentPos;
                    break;
                }
            }
            currentPos += len;
        }
        
        if (targetNode) {
            const range = document.createRange();
            range.setStart(targetNode, targetStart);
            range.setEnd(targetNode, targetEnd);
            
            const span = LookupHighlighter.highlightRange(range);
            if (span) {
                LookupHighlighter.scrollToElement(span);
                // Callback to perform lookup
                // [UPDATED] Pass the highlighted span, not the parent, for correct offset calc
                if (onLookupCallback) onLookupCallback(token.text, span);
            }
        }
    },

    _jumpSegment(currentNode, direction, onLookupCallback) {
        let currentWrapper = currentNode.parentElement;
        if (!currentWrapper.classList.contains('root')) {
            const pli = currentWrapper.querySelector('.root');
            if (pli) currentWrapper = pli; 
            else currentWrapper = currentWrapper.closest('.root');
        }

        if (!currentWrapper) return;
        
        const allSegments = Array.from(document.querySelectorAll('#sutta-container .root'));
        const currentIdx = allSegments.indexOf(currentWrapper);
        
        if (currentIdx === -1) return;
        
        let nextIdx = currentIdx + direction;
        
        // Skip hidden segments
        while (nextIdx >= 0 && nextIdx < allSegments.length) {
            if (allSegments[nextIdx].offsetParent !== null) {
                break;
            }
            nextIdx += direction;
        }
        
        if (nextIdx < 0 || nextIdx >= allSegments.length) return; 
        
        const targetWrapper = allSegments[nextIdx];
        const fullText = targetWrapper.textContent;
        const tokens = this._tokenize(fullText);
        
        if (tokens.length === 0) return;
        
        const targetToken = (direction === 1) ? tokens[0] : tokens[tokens.length - 1];
        
        this._selectTokenInParent(targetWrapper, targetToken, onLookupCallback);
    }
};