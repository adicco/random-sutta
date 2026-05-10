// Path: web/assets/modules/toolbar/search_engine.js

export class SearchEngine {
    constructor(rootElement) {
        this.root = rootElement;
        this.matches = [];
        this.currentIndex = -1;
        this.searchTerm = "";
    }

    /**
     * Clears all highlights and restores original text nodes
     */
    clear() {
        if (!this.matches || this.matches.length === 0) return;
        
        // Remove <mark> tags and normalize text nodes
        this.matches.forEach(mark => {
            const parent = mark.parentNode;
            if (parent) {
                const textNode = document.createTextNode(mark.textContent);
                parent.replaceChild(textNode, mark);
                parent.normalize(); // Merges adjacent text nodes
            }
        });
        
        this.matches = [];
        this.currentIndex = -1;
        this.searchTerm = "";
    }

    /**
     * Searches for text in the root element and highlights it
     * @param {string} term 
     * @returns {number} The number of matches found
     */
    search(term) {
        this.clear();
        if (!term || term.trim() === "") return 0;
        
        this.searchTerm = term.toLowerCase();
        this.matches = [];
        
        this._traverseAndHighlight(this.root, this.searchTerm);
        
        if (this.matches.length > 0) {
            this.currentIndex = 0;
            this._updateActiveHighlight();
            this._scrollToActive();
        }
        
        return this.matches.length;
    }

    _traverseAndHighlight(node, term) {
        // Skip script tags, style tags, and already highlighted nodes
        if (node.nodeName === "SCRIPT" || node.nodeName === "STYLE" || node.nodeName === "MARK") {
            return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue.toLowerCase();
            const index = text.indexOf(term);
            
            if (index !== -1) {
                // We found a match in this text node
                const matchLength = term.length;
                const originalText = node.nodeValue;
                
                // Split the text node
                const beforeText = document.createTextNode(originalText.substring(0, index));
                const matchText = document.createTextNode(originalText.substring(index, index + matchLength));
                const afterText = document.createTextNode(originalText.substring(index + matchLength));
                
                // Create <mark> element
                const mark = document.createElement("mark");
                mark.className = "search-highlight";
                mark.appendChild(matchText);
                
                // Replace original node with parts
                const parent = node.parentNode;
                parent.insertBefore(beforeText, node);
                parent.insertBefore(mark, node);
                parent.insertBefore(afterText, node);
                parent.removeChild(node);
                
                this.matches.push(mark);
                
                // Recursively highlight the remaining text
                this._traverseAndHighlight(afterText, term);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Must convert to array to avoid issues when DOM is mutated during iteration
            const children = Array.from(node.childNodes);
            for (let child of children) {
                this._traverseAndHighlight(child, term);
            }
        }
    }

    next() {
        if (this.matches.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.matches.length;
        this._updateActiveHighlight();
        this._scrollToActive();
    }

    prev() {
        if (this.matches.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
        this._updateActiveHighlight();
        this._scrollToActive();
    }

    _updateActiveHighlight() {
        this.matches.forEach((mark, index) => {
            if (index === this.currentIndex) {
                mark.classList.add("active");
            } else {
                mark.classList.remove("active");
            }
        });
    }

    _scrollToActive() {
        const activeMark = this.matches[this.currentIndex];
        if (activeMark) {
            // Use block: 'center' so the match isn't hidden under headers/toolbars
            activeMark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    getMatchInfo() {
        if (this.matches.length === 0) return "0/0";
        return `${this.currentIndex + 1}/${this.matches.length}`;
    }
}
