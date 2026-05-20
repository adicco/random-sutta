// Path: web/assets/modules/ui/components/popup/state/popup_state.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("PopupState");

export const PopupState = {
    // Runtime Memory
    comments: [],     
    activeType: 'none', // 'comment' | 'quicklook' | 'none'
    activeIndex: -1,
    activeUrl: null,
    loadingUid: null, 

    // Secondary state for Nested Comments (Quicklook -> Comment)
    nestedActiveIndex: -1,
    nestedActiveText: null,

    // Parallels State
    parallelsOpen: false,
    parallelsNeedsScrollReset: false,

    isAutoSwitch: localStorage.getItem("comment_auto_switch") === "true",

    setComments(list) { this.comments = list || []; },

    setAutoSwitch(enabled) {
        this.isAutoSwitch = enabled;
        localStorage.setItem("comment_auto_switch", enabled);
    },

    getComments() { return this.comments; },

    setCommentActive(index) {
        this.activeType = 'comment';
        this.activeIndex = index;
        this.activeUrl = null;
    },

    setQuicklookActive(url) {
        this.activeType = 'quicklook';
        this.activeUrl = url;
    },

    clearActive() {
        this.activeType = 'none';
        this.activeIndex = -1;
        this.activeUrl = null;
        this.nestedActiveIndex = -1;
        this.nestedActiveText = null;
    },

    saveSnapshot() {
        try {
            const currentState = window.history.state || {};
            const snapshot = {
                type: this.activeType,
                commentIndex: this.activeIndex,
                quicklookUrl: this.activeUrl,
                parallelsOpen: this.parallelsOpen
            };
            logger.info("Snapshot", `Saved: ${snapshot.type}`, snapshot);
            
            window.history.replaceState(
                { ...currentState, popupSnapshot: snapshot }, 
                document.title, 
                window.location.href
            );
        } catch (e) {
            logger.error("Snapshot", "Save failed", e);
        }
    },

    getSnapshot() {
        try {
            const state = window.history.state;
            if (state && state.popupSnapshot) return state.popupSnapshot;
        } catch (e) {}
        return null;
    }
};