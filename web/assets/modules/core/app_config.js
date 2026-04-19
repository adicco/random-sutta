// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // ... (Giữ nguyên các config cũ)
    BUFFER_SIZE: 3, 
    INITIAL_PRELOAD_DELAY: 3000,
    IDLE_CALLBACK_TIMEOUT: 2000,
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000,

    TTS: {
        SCROLL_OFFSET_TOP: '30vh',
        BOTTOM_PADDING: '150px', 
        
        DEFAULT_VOICE: {
            voiceURI: "en-US-Chirp3-HD-Algenib"
        },

        // Danh sách Recommended (Giờ đây không cần hardcode cờ vào name nữa)
        RECOMMENDED_VOICES: [
            { 
                voiceURI: "en-US-Chirp3-HD-Algenib", 
                name: "Chirp 3 Algenib (Deep)" 
            },
            { 
                voiceURI: "en-US-Chirp3-HD-Puck", 
                name: "Chirp 3 Puck (Clear)" 
            },
            { 
                voiceURI: "en-US-Chirp3-HD-Kore", 
                name: "Chirp 3 Kore (Firm) (Female)" 
            },
            { 
                voiceURI: "en-US-Chirp3-HD-Zephyr", 
                name: "Chirp 3 Zephyr (Soft) (Female)" 
            },
        ],
        
        BUFFER_AHEAD: 7,
        PARAGRAPH_SPLIT_THRESHOLD: 300
    },

    LOOKUP: {
        SCROLL_OFFSET_RATIO: 0.25, // Position lookup selection at 1/4 screen height
        
        // Dictionary Sources Configuration
        DICTIONARIES: {
            "pali_dpd": {
                enabled: true,
                name: "dpd_mini.db",
                path: "assets/db/dictionaries/dpd_mini.db.zip",
                triggerSelectors: [".pli", ".lookup-main-content", ".dpd-deconstruction"] // Active in sutta and internal lookups
            }
            // Future: "en_vi": { ..., triggerSelectors: [".eng", ".en"] }
        }
    },

    POPUP_LAYOUT: {
        COMMENT_HEIGHT_VH: 45, 
        QUICKLOOK_TOP_OFFSET_PX: 0 
    },

    SEPIA: {
        MAX_CSS_LIGHT: 50,
        MAX_CSS_DARK: 100,
        HUE_COEFF: -0.25, 
        SATURATE: 1.0,
        STORAGE_KEY_PREFIX: "sutta_sepia_"
    },

    PERSISTENT_SETTINGS: [
        "sutta_theme",
        "sutta_font_scale",
        "sutta_sepia_light",
        "sutta_sepia_dark",
        "tts_rate",
        "tts_voice_uri",
        "tts_auto_next"
    ]
};