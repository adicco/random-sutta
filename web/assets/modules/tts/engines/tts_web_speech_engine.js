// Path: web/assets/modules/tts/engines/tts_web_speech_engine.js
import { getLogger } from 'utils/logger.js'; 

const logger = getLogger("TTS_WebSpeech");

export class TTSWebSpeechEngine {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.rate = 1.0;
        this.pitch = 1.0;
        
        // Callback để báo cho Orchestrator biết danh sách giọng đã sẵn sàng/thay đổi
        this.onVoicesChanged = null; 
        
        this.currentUtterance = null;
        this.isReady = false;

        if (!this.synth) {
            logger.warn("Init", "window.speechSynthesis is not supported in this environment.");
            return;
        }

        // [CRITICAL] Bind event properly
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => {
                logger.info("Lifecycle", "Browser voices changed/loaded.");
                this._autoSelectVoice();
                if (this.onVoicesChanged) {
                    this.onVoicesChanged(this.getVoices());
                }
            };
        }

        // Initial Load Attempt
        if (this.synth && (this.synth ? this.synth.getVoices() : []).length > 0) {
            this._autoSelectVoice();
        }
        
        this._loadSettings();
    }

    /**
     * Tự động chọn giọng mặc định tốt nhất nếu chưa chọn
     */
    _autoSelectVoice() {
        const voices = (this.synth ? this.synth.getVoices() : []);
        if (voices.length === 0) return;
        this.isReady = true;

        // Nếu đã có giọng chọn từ trước (qua setVoice hoặc loadSettings), kiểm tra xem nó còn tồn tại không
        if (this.voice) {
            const stillExists = voices.find(v => v.voiceURI === this.voice.voiceURI);
            if (!stillExists) this.voice = null; // Reset nếu giọng cũ không còn
        }

        // Nếu chưa có giọng, chọn mặc định
        if (!this.voice) {
             this.voice = voices.find(v => v.name.includes("Google US English")) ||
                          voices.find(v => v.lang === "en-US" && !v.localService) || // Ưu tiên giọng Online chất lượng cao
                          voices.find(v => v.lang === "en-US") || 
                          voices.find(v => v.lang.startsWith("en"));
            
            if (this.voice) {
                logger.info("AutoSelect", `Selected default: ${this.voice.name}`);
            }
        }
    }

    _loadSettings() {
        const savedRate = localStorage.getItem("tts_rate");
        const savedPitch = localStorage.getItem("tts_pitch");
        const savedVoiceURI = localStorage.getItem("tts_voice_uri");
        
        if (savedRate) this.rate = parseFloat(savedRate);
        if (savedPitch) this.pitch = parseFloat(savedPitch);
        
        if (savedVoiceURI) {
            // Lưu lại URI để dùng khi voices load xong (nếu chưa xong)
            this.pendingVoiceURI = savedVoiceURI;
            this.setVoice(savedVoiceURI);
        }
    }

    /**
     * Trả về danh sách giọng đã được chuẩn hóa format
     */
    getVoices() {
        const rawVoices = (this.synth ? this.synth.getVoices() : []);
        if (rawVoices.length === 0) return [];

        // Lọc giọng tiếng Anh để tránh rác list
        return rawVoices
            .filter(v => v.lang.startsWith('en'))
            .map(v => ({
                voiceURI: v.voiceURI, // ID duy nhất
                name: v.name,
                lang: v.lang,
                localService: v.localService,
                default: v.default
            }));
    }

    setVoice(voiceURI) {
        const voices = (this.synth ? this.synth.getVoices() : []);
        // Nếu voices chưa load, lưu tạm vào biến pending để _autoSelectVoice xử lý sau
        if (voices.length === 0) {
            this.pendingVoiceURI = voiceURI;
            return;
        }

        const found = voices.find(v => v.voiceURI === voiceURI);
        if (found) {
            this.voice = found;
            localStorage.setItem("tts_voice_uri", voiceURI);
            logger.info("SetVoice", `Set to: ${found.name}`);
        } else {
            logger.warn("SetVoice", `Voice URI not found: ${voiceURI}`);
        }
    }

    setRate(rate) {
        this.rate = parseFloat(rate);
        localStorage.setItem("tts_rate", this.rate);
    }

    setPitch(pitch) {
        this.pitch = parseFloat(pitch);
        localStorage.setItem("tts_pitch", this.pitch);
    }

    /**
     * Core Speak Function
     */
    speak(text, onEnd, onBoundary) {
        // [FIX] Cancel any ongoing speech immediately
        this.synth.cancel();

        if (!text) { 
            if (onEnd) onEnd(); 
            return Promise.resolve();
        }

        // [FIX] Nếu voice chưa sẵn sàng (đang load), đợi 1 chút hoặc fail gracefully
        if (!this.voice && this.isReady) {
            // Cố gắng auto select lần nữa
            this._autoSelectVoice();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;
        
        if (this.voice) {
            utterance.voice = this.voice;
        } else {
            // Fallback cực đoan: Không set voice, để browser tự quyết
            logger.warn("Speak", "No specific voice selected, using browser default.");
        }

        utterance.rate = this.rate;
        utterance.pitch = this.pitch;

        utterance.onend = () => { 
            this.currentUtterance = null;
            if (onEnd) onEnd(); 
        };

        utterance.onerror = (e) => {
            // [FIX] 'interrupted' or 'canceled' are normal during skipping/stopping. Do not treat as error.
            if (e.error === 'interrupted' || e.error === 'canceled') {
                // logger.debug("Speak", "Interrupted/Canceled (Normal)");
                return; 
            }
            
            logger.error("Speak error", `Code: ${e.error}`);
            this.currentUtterance = null;
            // Vẫn gọi onEnd để playlist tiếp tục (trừ khi lỗi quá nghiêm trọng)
            if (onEnd) onEnd();
        };

        if (onBoundary) {
            utterance.onboundary = onBoundary;
        }

        // [FIX] Timeout hack fix for Chrome hanging on long texts
        // Nhưng ở đây dùng để đảm bảo stack clear trước khi speak
        setTimeout(() => {
            try {
                this.synth.speak(utterance);
                
                // [WORKAROUND] Chrome Bug: Speech stops after ~15 seconds if not paused/resumed
                // Chúng ta sẽ xử lý việc này ở tầng cao hơn (chia nhỏ đoạn văn) 
                // nhưng ở đây thêm log nếu cần debug.
            } catch (err) {
                logger.error("Speak exec error", err);
                if (onEnd) onEnd();
            }
        }, 10);

        return Promise.resolve();
    }

    pause() { if (this.synth) this.synth.pause(); }
    resume() { if (this.synth) this.synth.resume(); }
    
    stop() { 
        try {
            if (this.synth) this.synth.cancel();
        } catch(e) { /* ignore */ }
        this.currentUtterance = null;
    }
}