// Path: web/assets/modules/lookup/core/lookup_state.js

export const LookupState = {
    highlightNode: null,
    currentStart: 0,
    currentEnd: 0,
    isNavigating: false,
    
    // Internal History (Inside Popup)
    history: [],
    forwardStack: [],

    reset() {
        this.highlightNode = null;
        this.currentStart = 0;
        this.currentEnd = 0;
        this.isNavigating = false;
        this.clearHistory();
    },

    setHighlight(node, start, end) {
        this.highlightNode = node;
        this.currentStart = start;
        this.currentEnd = end;
    },
    
    getHighlightNode() {
        // Validation check for detached nodes
        if (this.highlightNode && !this.highlightNode.isConnected) {
            // Try to recover? Or just return null
            return null;
        }
        return this.highlightNode;
    },

    pushHistory(state) {
        if (!state) return;
        this.history.push(state);
        // Clear forward stack when a new action is performed
        this.forwardStack = [];
    },

    popHistory() {
        return this.history.pop();
    },

    pushForward(state) {
        this.forwardStack.push(state);
    },

    popForward() {
        return this.forwardStack.pop();
    },

    clearHistory() {
        this.history = [];
        this.forwardStack = [];
    }
};