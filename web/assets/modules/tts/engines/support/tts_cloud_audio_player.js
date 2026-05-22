// Path: web/assets/modules/tts/engines/support/tts_cloud_audio_player.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("TTS_CloudPlayer");

export class TTSCloudAudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.onEnd = null;
        this.isPlaying = false;
        this._isUnlocked = false;

        // Bind events
        this.audio.onended = () => {
            this.isPlaying = false;
            logger.debug("Playback", "Ended");
            if (this.onEnd) this.onEnd();
        };

        this.audio.onerror = (e) => {
            this.isPlaying = false;
            const error = this.audio.error;
            logger.error("Playback", `Error code: ${error ? error.code : 'unknown'}, Message: ${e.message || "Unknown error"}`);
            // Fallback: treat error as end to prevent hanging
            if (this.onEnd) this.onEnd();
        };
    }

    /**
     * Unlocks the audio element on iOS. Must be called from a user gesture.
     */
    unlock() {
        if (this._isUnlocked) return;
        
        // Play a tiny silent buffer or just try to play the current (empty) state
        this.audio.play().then(() => {
            this.audio.pause();
            this._isUnlocked = true;
            logger.info("Playback", "Audio unlocked successfully");
        }).catch(err => {
            // This is expected if no src is set yet, but it still "warms up" the element on some iOS versions
            logger.debug("Playback", "Unlock attempt (normal if catch): " + err.message);
        });
    }

    /**
     * Plays an audio blob or URL.
     * @param {Blob|string} source - The audio source.
     * @param {Function} onEndCallback - Called when playback finishes.
     * @param {number} rate - Playback speed (default 1.0).
     */
    play(source, onEndCallback, rate = 1.0) {
        this.stop(); // Stop any previous playback

        this.onEnd = onEndCallback;
        
        let url;
        if (source instanceof Blob) {
            url = URL.createObjectURL(source);
        } else {
            url = source;
        }

        this.audio.src = url;
        this.audio.playbackRate = rate;
        
        // [FIX] Explicitly call load() for iOS stability with Blobs
        this.audio.load();
        
        // Small delay to ensure iOS has processed the new source
        const attemptPlay = () => {
            this.audio.play()
                .then(() => {
                    this.isPlaying = true;
                    logger.debug("Playback", "Started");
                })
                .catch(err => {
                    logger.error("Playback", "Play request failed", err);
                    // If blocked by gesture (NotAllowedError), we need to tell the user
                    if (err.name === 'NotAllowedError') {
                        logger.warn("Playback", "Playback blocked by browser policy. Interaction required.");
                    }
                    if (this.onEnd) this.onEnd();
                });
        };

        if (window.requestAnimationFrame) {
            requestAnimationFrame(attemptPlay);
        } else {
            setTimeout(attemptPlay, 0);
        }
    }

    setRate(rate) {
        if (this.audio) {
            this.audio.playbackRate = rate;
        }
    }

    pause() {
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
        }
    }

    resume() {
        if (this.audio.src && this.audio.paused) {
            this.audio.play();
            this.isPlaying = true;
        }
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        // Clean up object URL if needed to avoid memory leaks?
        // Browser handles some, but explicit revoke is better if we store the URL.
        // Since we create fresh URL each play, garbage collection handles it eventually,
        // but for long sessions explicit revoke is safer.
        if (this.audio.src.startsWith("blob:")) {
            URL.revokeObjectURL(this.audio.src);
        }
        this.audio.removeAttribute("src");
    }
}