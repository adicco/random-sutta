// Path: web/assets/modules/tts/core/tts_orchestrator.js
import { TTSStateStore } from './tts_state_store.js'; // Cùng thư mục thì giữ ./ cũng được
import { TTSPlayer } from './tts_player.js';
import { TTSHighlighter } from './tts_highlighter.js';
import { TTSSessionManager } from './tts_session_manager.js';
import { TTSMarkerManager } from './tts_marker_manager.js';
// [FUTURE PROOF]
import { getLogger } from 'utils/logger.js'; 

import { TTSEngineRegistry } from './orchestrator/engine_registry.js';
import { TTSPlaybackController } from './orchestrator/playback_controller.js';
import { TTSUISynchronizer } from './orchestrator/ui_synchronizer.js';

const logger = getLogger("TTS_Orchestrator");

export const TTSOrchestrator = {
    registry: null,
    playback: null,
    uiSync: null,

    init() {
        TTSStateStore.init();

        // 1. Initialize Sub-modules
        this.registry = new TTSEngineRegistry();
        this.registry.init();

        this.uiSync = new TTSUISynchronizer(this.registry);
        this.playback = new TTSPlaybackController(this.uiSync);

        // 2. Wire up Events
        
        // When Engine changes -> Rebind Player & Sync UI
        this.registry.onEngineChanged = (newEngine) => {
            this._bindPlayer(newEngine);
            this._bindEngineEvents(newEngine); // [NEW] Bind events generically
            this.uiSync.onEngineChanged(newEngine);
            
            // Check cache status for markers
            if (TTSSessionManager.isActive()) {
                TTSMarkerManager.checkCacheStatus(newEngine);
            }
        };

        // When Audio Cached (GCloud) -> Update Marker & UI
        this.registry.onAudioCached = (text) => {
            TTSMarkerManager.markAsCached(text);
            this.uiSync.debouncedRefreshOfflineStatus();
        };

        // [REMOVED] Hardcoded GCloud binding
        
        // 3. Initial Binding
        const initialEngine = this.registry.getActiveEngine();
        this._bindPlayer(initialEngine);
        this._bindEngineEvents(initialEngine);
        
        // 4. Setup Session Manager
        TTSSessionManager.init(TTSPlayer, TTSHighlighter, null); // UI injected later

        // 5. Setup Player Callback
        TTSPlayer.setCallbacks(() => this.playback.handlePlaylistEnd());

        logger.info("Init", "Orchestrator Initialized (Modular)");
    },

    // Helper to connect Player with Engine
    _bindPlayer(engine) {
        // Stop old playback first
        TTSPlayer.stop(); 
        // Re-init with new engine, keeping existing Highlighter/UI refs
        TTSPlayer.init(engine, TTSHighlighter, this.uiSync.ui);
    },

    // [NEW] Helper to bind generic engine events (Voices, Cache)
    _bindEngineEvents(engine) {
        if (!engine) return;

        // 1. Voice Changed Event
        // Ensure we don't overwrite if the engine uses it internally, 
        // but typically the engine calls this.onVoicesChanged() if set.
        engine.onVoicesChanged = (voices) => {
            // [FIX] Only update UI if this engine is currently active
            if (this.registry.getActiveEngine() !== engine) {
                return;
            }

            // Note: 'voices' passed here might differ in format per engine, 
            // but uiSync/UI should handle the standardized format.
            if (this.uiSync.ui) { 
                const currentVoice = engine.voice; // Get current selected voice from engine
                this.uiSync.ui.populateVoices(voices, currentVoice);
                this.uiSync.refreshOfflineVoicesStatus();
            }
        };

        // 2. Audio Cache Event (Re-bind if engine supports it)
        // Some engines might not have this property initially
        engine.onAudioCached = (text) => {
             TTSMarkerManager.markAsCached(text);
        };
    },

    setUI(uiInstance) {
        // Inject UI into subsystems
        TTSHighlighter.setUI(uiInstance);
        TTSPlayer.ui = uiInstance;
        TTSSessionManager.ui = uiInstance;
        
        // Inject into Synchronizer
        this.uiSync.setUI(uiInstance);
    },

    setCallbacks(callbacks) {
        this.playback.setCallbacks(callbacks);
    },

    // --- Public API Delegation ---

    // Playback
    togglePlay() { 
        this.playback.togglePlay(); 
        // [FIX] Always try to unlock on toggle (user gesture)
        TTSPlayer.unlock();
    },
    play() { 
        this.playback.play(); 
        TTSPlayer.unlock();
    },
    pause() { this.playback.pause(); },
    stop() { this.playback.stop(); },
    next() { 
        this.playback.next(); 
        TTSPlayer.unlock();
    },
    prev() { 
        this.playback.prev(); 
        TTSPlayer.unlock();
    },
    jumpToID(id) { 
        this.playback.jumpToID(id); 
        TTSPlayer.unlock();
    },
    
    // State & Config
    setAutoNext(e) { TTSStateStore.setAutoNext(e); },
    setPlaybackMode(m) { this.playback.setPlaybackMode(m); },
    
    // Engine & Voice
    switchEngine(id) { 
        if (this.registry.switchEngine(id)) {
            // Update UI visibility for API Key (handled in registry event? No, explicit here for safety)
            this.uiSync.ui.updateEngineState(id, null);
        }
    },
    setGCloudApiKey(k) { this.registry.setGCloudApiKey(k); },
    refreshVoices() { this.registry.refreshVoices(); },
    setVoice(uri) { 
        this.registry.setVoice(uri);
        // Trigger status updates if session active
        if (this.isSessionActive()) {
            TTSMarkerManager.checkCacheStatus(this.registry.getActiveEngine());
        }
    },
    
    // Session
    startSession() { 
        TTSSessionManager.start(); 
        this.uiSync.refreshOfflineVoicesStatus();
    },
    endSession() { TTSSessionManager.end(); },
    refreshSession(autoPlay) { 
        TTSSessionManager.refresh(autoPlay);
        this.uiSync.refreshOfflineVoicesStatus();
    },
    
    isSessionActive() { return TTSSessionManager.isActive(); },
    isPlaying() { return TTSStateStore.isPlaying; },
    
    // Specific Exposed Methods
    refreshOfflineVoicesStatus() { this.uiSync.refreshOfflineVoicesStatus(); },
    
    // Accessors
    get engine() { return this.registry.getActiveEngine(); } // Backward compatibility if needed
};