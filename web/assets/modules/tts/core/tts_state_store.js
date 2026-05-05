// Path: web/assets/modules/tts/core/tts_state_store.js
export const TTSStateStore = {
    // Runtime State
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    
    // [NEW] Session State: Chỉ True khi người dùng chủ động mở Player
    isSessionActive: false,
    
    // Settings Defaults
    autoNextEnabled: true,
    playbackMode: 'paragraph', // 'segment' | 'paragraph'
    activeEngine: 'wsa', // 'wsa' | 'gcloud'

    init() {
        this._loadSettings();
        
        // Listen for sync updates
        window.addEventListener("sync-data-applied", () => {
            this._loadSettings();
        });
    },

    _loadSettings() {
        const savedAutoNext = localStorage.getItem("tts_auto_next");
        if (savedAutoNext !== null) {
            this.autoNextEnabled = (savedAutoNext === "true");
        }
        
        const savedMode = localStorage.getItem("tts_playback_mode");
        if (savedMode) {
            this.playbackMode = savedMode;
        }

        const savedEngine = localStorage.getItem("tts_active_engine");
        if (savedEngine) {
            this.activeEngine = savedEngine;
        }
        
        console.log("StateStore: Loaded settings", {
            autoNext: this.autoNextEnabled,
            mode: this.playbackMode,
            engine: this.activeEngine
        });
    },

    setAutoNext(enabled) {
        this.autoNextEnabled = enabled;
        localStorage.setItem("tts_auto_next", enabled);
        window.dispatchEvent(new CustomEvent("local-data-changed"));
        console.log("StateStore: Saved AutoNext ->", enabled); // LOG
    },
    
    setPlaybackMode(mode) {
        this.playbackMode = mode;
        localStorage.setItem("tts_playback_mode", mode);
        window.dispatchEvent(new CustomEvent("local-data-changed"));
        console.log("StateStore: Saved Mode ->", mode); // LOG
    },

    setActiveEngine(engineId) {
        this.activeEngine = engineId;
        localStorage.setItem("tts_active_engine", engineId);
        window.dispatchEvent(new CustomEvent("local-data-changed"));
        console.log("StateStore: Saved Engine ->", engineId); // LOG
    },

    // [NEW] Session Management
    setSessionActive(active) {
        this.isSessionActive = active;
    },

    resetPlaylist(newPlaylist) {
        this.playlist = newPlaylist;
        this.currentIndex = 0;
    },

    getCurrentItem() {
        if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
            return this.playlist[this.currentIndex];
        }
        return null;
    },

    getNextItem() {
        const nextIndex = this.currentIndex + 1;
        if (nextIndex < this.playlist.length) {
            return this.playlist[nextIndex];
        }
        return null;
    },

    hasNext() {
        return this.currentIndex < this.playlist.length - 1;
    },

    hasPrev() {
        return this.currentIndex > 0;
    },

    advance() {
        if (this.hasNext()) {
            this.currentIndex++;
            return true;
        }
        return false;
    },

    retreat() {
        if (this.hasPrev()) {
            this.currentIndex--;
            return true;
        }
        return false;
    }
};