// Path: web/assets/modules/tts/core/tts_player.js
import { TTSStateStore } from './tts_state_store.js';
import { AppConfig } from 'core/app_config.js';

export const TTSPlayer = {
    engine: null,
    highlighter: null,
    ui: null,
    onPlaylistEnd: null, // Callback khi đọc hết bài
    farthestPrefetchedIndex: -1,

    init(engine, highlighter, ui) {
        this.engine = engine;
        this.highlighter = highlighter;
        this.ui = ui;
    },

    reset() {
        this.farthestPrefetchedIndex = -1;
    },

    setCallbacks(onPlaylistEnd) {
        this.onPlaylistEnd = onPlaylistEnd;
    },

    /**
     * Unlocks the audio system on iOS.
     * MUST be called from a user interaction event handler.
     */
    unlock() {
        if (this.engine && typeof this.engine.unlock === 'function') {
            this.engine.unlock();
        }
    },

    // --- Core Operations ---

    play() {
        TTSStateStore.isPlaying = true;
        if (this.ui) this.ui.updatePlayState(true);
        this._speakCurrent();
    },

    pause() {
        TTSStateStore.isPlaying = false;
        if (this.ui) this.ui.updatePlayState(false);
        // [FIX] Null check
        if (this.engine) this.engine.pause();
    },

    stop() {
        TTSStateStore.isPlaying = false;
        if (this.ui) this.ui.updatePlayState(false);
        // [FIX] Null check (Critical for startup)
        if (this.engine) this.engine.stop();
        // Player stop không có trách nhiệm clear highlight (để giữ vị trí đọc)
    },

    next() {
        // [FIX] Null check
        if (this.engine) this.engine.stop();
        
        if (TTSStateStore.hasNext()) {
            TTSStateStore.advance();
            this._activateAndPlayIfRunning();
        } else {
            this._triggerEnd();
        }
    },

    prev() {
        // [FIX] Null check
        if (this.engine) this.engine.stop();

        if (TTSStateStore.hasPrev()) {
            TTSStateStore.retreat();
            this._activateAndPlayIfRunning();
        }
    },

    jumpTo(index) {
        if (index < 0 || index >= TTSStateStore.playlist.length) return;
        
        // [FIX] Null check
        if (this.engine) this.engine.stop();
        
        TTSStateStore.currentIndex = index;
        
        // Highlight ngay lập tức
        this.highlighter.activate(index);
        // Nếu đang play thì đọc luôn, không thì thôi
        if (TTSStateStore.isPlaying) {
            this._speakCurrent();
        }
    },

    // --- Helpers ---

    _activateAndPlayIfRunning() {
        const idx = TTSStateStore.currentIndex;
        this.highlighter.activate(idx);
        if (TTSStateStore.isPlaying) {
            this._speakCurrent();
        }
    },

    async _speakCurrent() {
        const item = TTSStateStore.getCurrentItem();
        if (!item) return;
        
        // [FIX] Safety check if engine is lost
        if (!this.engine) return;

        // Đảm bảo highlight đúng câu đang đọc
        this.highlighter.activate(TTSStateStore.currentIndex);
        try {
            // Priority 1: Await prefetch of the CURRENT item to ensure it's ready.
            if (this.engine.prefetch) {
                await this.engine.prefetch(item.text);
            }

            // Priority 2: Fire-and-forget prefetch for the VERY NEXT item.
            const nextItem = TTSStateStore.getNextItem(); // Helper to get item at currentIndex + 1
            if (nextItem && this.engine.prefetch) {
                this.engine.prefetch(nextItem.text);
            }

            // Now that the current item is guaranteed to be cached, speak it.
            // The `speak` call will be instant if the prefetch worked.
            this.engine.speak(item.text, () => {
                // onEnd: Callback khi đọc xong 1 câu
                if (TTSStateStore.isPlaying) {
                    if (TTSStateStore.hasNext()) {
                        TTSStateStore.advance();
                        this._speakCurrent(); // Đệ quy đọc câu tiếp
                    } else {
                        this._triggerEnd();
                    }
                }
            }).catch(e => {
                // This catch is for playback errors, not prefetch errors.
                console.error("TTS Player Playback Error:", e);
                this.stop();
                if (this.ui && this.ui.showError) this.ui.showError("Playback error.");
            });
            
            // Priority 3: Manage the rest of the rolling buffer in the background.
            this._managePrefetchBuffer();
        } catch (e) {
            // This catch is for prefetch/setup errors (e.g., missing API key).
            console.error("TTS Player Setup Error:", e);
            this.stop(); // Stop playback on hard error
            if (this.ui && this.ui.showError) {
                this.ui.showError(e.message);
            }
        }
    },

    _managePrefetchBuffer() {
        if (!this.engine || !this.engine.prefetch) return;
        const { currentIndex, playlist } = TTSStateStore;
        const bufferSize = AppConfig.TTS?.BUFFER_AHEAD || 7;
        // The index of the farthest item we want to have in our buffer
        const desiredFarthestIndex = Math.min(currentIndex + bufferSize, playlist.length - 1);
        // If we've already queued everything up to this point, no need to do more.
        if (this.farthestPrefetchedIndex >= desiredFarthestIndex) {
            return;
        }

        // Fetch the items from our last known point to the new desired point.
        const startIndex = this.farthestPrefetchedIndex + 1;
        for (let i = startIndex; i <= desiredFarthestIndex; i++) {
            const item = playlist[i];
            if (item) {
                this.engine.prefetch(item.text);
            }
        }
        
        // Update the high-water mark
        this.farthestPrefetchedIndex = desiredFarthestIndex;
    },

    _triggerEnd() {
        if (this.onPlaylistEnd) this.onPlaylistEnd();
        else this.stop();
    }
};