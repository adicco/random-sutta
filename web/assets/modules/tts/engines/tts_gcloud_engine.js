// Path: web/assets/modules/tts/engines/tts_gcloud_engine.js
import { TTSGoogleCloudFetcher } from './support/tts_gcloud_fetcher.js';
import { TTSAudioCache } from './support/tts_audio_cache.js';
import { TTSCloudAudioPlayer } from './support/tts_cloud_audio_player.js';

// Sub-modules
import { GCloudConfigManager } from './gcloud/config_manager.js';
import { GCloudVoiceManager } from './gcloud/voice_manager.js';
import { GCloudSynthesizer } from './gcloud/synthesizer.js';

export class TTSGoogleCloudEngine {
    constructor() {
        // Core Dependencies
        this.fetcher = new TTSGoogleCloudFetcher(null);
        this.cache = new TTSAudioCache();
        this.player = new TTSCloudAudioPlayer();

        // Logic Modules
        this.config = new GCloudConfigManager();
        this.voiceMgr = new GCloudVoiceManager(this.fetcher, this.config);
        this.synth = new GCloudSynthesizer(this.fetcher, this.cache, this.player, this.config);

        // Sync Fetcher Key initially
        this.fetcher.setApiKey(this.config.getApiKey());

        // Event Proxy
        this.onVoicesChanged = null;
        this.onAudioCached = null;

        // Internal Binding
        this.voiceMgr.onVoicesChanged = (list, current) => {
            if (this.onVoicesChanged) this.onVoicesChanged(list, current);
        };
        this.synth.onAudioCached = (text) => {
            if (this.onAudioCached) this.onAudioCached(text);
        };

        // Auto Refresh on Init if Key exists
        if (this.config.getApiKey()) {
            setTimeout(() => this.voiceMgr.refresh(false), 100);
        }
    }

    // --- Public API (Facade) ---

    setApiKey(key) {
        this.config.setApiKey(key);
        this.fetcher.setApiKey(key);
        if (key) this.voiceMgr.refresh(true);
    }

    refreshVoices() { this.voiceMgr.refresh(true); }
    getVoices() { return this.voiceMgr.getList(); }
    
    setVoice(uri) { 
        const list = this.voiceMgr.getList();
        const found = list.find(v => v.voiceURI === uri);
        if (found) this.config.setVoice(found);
        else if (uri) this.config.setVoice({ voiceURI: uri, name: uri, lang: 'en-US' });
    }

    setRate(rate) { 
        this.config.setRate(rate);
        this.player.setRate(rate);
    }

    // [FIX] Added 'return' to expose the Promise from synthesizer
    speak(text, onEnd, onBoundary) { 
        return this.synth.speak(text, onEnd); 
    }
    
    // [FIX] Added 'return' just in case caller awaits it
    prefetch(text) { 
        return this.synth.prefetch(text); 
    }
    
    stop() { this.synth.cancel(); }
    pause() { this.player.pause(); }
    resume() { this.player.resume(); }

    // [NEW] Unlocks audio on iOS
    unlock() { this.player.unlock(); }

    // Properties accessors for UI
    get voice() { return this.config.getVoice(); }
    get rate() { return this.config.getRate(); }
    get apiKey() { return this.config.getApiKey(); }

    // Offline Helper
    async isCached(text) {
        // Delegate to synth for consistent logic (O(1) check)
        return this.synth.isCached(text);
    }

    async getOfflineVoices(textList) {
        const list = this.voiceMgr.getList();
        if (!textList.length) return [];
        const offline = [];
        for (const v of list) {
            // Check if the first segment is cached for this voice
            const key = this.cache.generateKey(textList[0], v.voiceURI);
            if (this.cache.hasKey(key)) {
                offline.push(v.voiceURI);
            }
        }
        return offline;
    }
}