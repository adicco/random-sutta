// Path: web/assets/modules/tts/engines/support/tts_gcloud_fetcher.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("TTS_GCloudFetcher");

const API_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

export class TTSGoogleCloudFetcher {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.onPitchRetry = null;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    /**
     * Fetches audio for the given text.
     * @param {string} text 
     * @param {string} languageCode (e.g., "en-US")
     * @param {string} voiceName (e.g., "en-US-Neural2-D")
     * @param {number} speakingRate (0.25 to 4.0)
     * @param {number} pitch (-20.0 to 20.0)
     * @returns {Promise<Blob>} Audio Blob
     */
    async fetchAudio(text, languageCode = "en-US", voiceName = "en-US-Neural2-D", speakingRate = 1.0, pitch = 0.0) {
        if (!this.apiKey) {
            throw new Error("Missing Google Cloud API Key");
        }

        // [Fix] Clamp values to API limits to prevent 400 Bad Request
        const safeRate = Math.max(0.25, Math.min(4.0, Number(speakingRate)));
        const safePitch = Math.max(-20.0, Math.min(20.0, Number(pitch)));

        const payload = {
            input: { text: text },
            voice: {
                languageCode: languageCode,
                name: voiceName
            },
            audioConfig: {
                audioEncoding: "MP3",
                speakingRate: safeRate,
                pitch: safePitch,
                effectsProfileId: ["headphone-class-device"]
            }
        };

        const url = `${API_ENDPOINT}?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error?.message || response.statusText;
                
                // [Fix] Fallback for voices that don't support pitch
                if (errorMessage.includes("does not support pitch") && pitch !== 0.0) {
                    logger.warn("Fetch", `Voice '${voiceName}' does not support pitch. Retrying with pitch 0.`);
                    if (this.onPitchRetry) this.onPitchRetry(voiceName);
                    return this.fetchAudio(text, languageCode, voiceName, speakingRate, 0.0);
                }

                // [Debug] Log payload details on error
                logger.error("Fetch", `API Error ${response.status}: ${JSON.stringify(errorData)}`);
                logger.debug("Fetch", `Failed Payload: Rate=${safeRate}, Pitch=${safePitch}, TextLen=${text.length}`);
                throw new Error(`Google TTS API Error: ${errorMessage}`);
            }

            const data = await response.json();
            
            if (data.audioContent) {
                // Convert Base64 to Blob
                return this._base64ToBlob(data.audioContent, "audio/mp3");
            } else {
                throw new Error("No audio content received");
            }

        } catch (e) {
            logger.error("Fetch", "Network or logic error", e);
            throw e;
        }
    }

    _base64ToBlob(base64, mimeType) {
        const bin = atob(base64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = bin.charCodeAt(i);
        }
        return new Blob([bytes], { type: mimeType });
    }

    /**
     * Fetches list of available voices from Google Cloud.
     * @returns {Promise<Array>} List of voices
     */
    async fetchVoices() {
        if (!this.apiKey) {
            throw new Error("Missing Google Cloud API Key");
        }

        // [UPDATED] Fetch ALL voices (remove languageCode filter)
        const url = `https://texttospeech.googleapis.com/v1/voices?key=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch voices");
            }
            const data = await response.json();
            
            // Client-side filter for English voices (broad match)
            // Google returns 'languageCodes': ['en-US', 'zh-CN'] etc.
            const allVoices = data.voices || [];
            
            const englishVoices = allVoices.filter(v => {
                // Check if any supported language code starts with 'en-'
                return v.languageCodes && v.languageCodes.some(code => code.startsWith('en-'));
            });

            // Map to our standard format here if needed, or let the engine handle it.
            // Engine expects raw list, so we return raw list but filtered.
            // But wait, the engine wrapper maps it. 
            // We just return the raw array here.
            
            // Note: Google's structure is:
            // { name: "...", languageCodes: [], ssmlGender: "...", ... }
            // Our system expects "lang" property. Google gives "languageCodes".
            // We should map it to standard format expected by our UI?
            // Actually, TTSGCloudEngine maps it. Let's just return filtered list.
            // BUT: We must ensure we pick the PRIMARY language code as 'lang' for later filtering.
            
            // Let's modify the objects slightly to be friendlier to our Engine
            return englishVoices.map(v => ({
                ...v,
                lang: v.languageCodes[0] // Pick first code (e.g. en-US) as primary lang
            }));

        } catch (e) {
            logger.error("FetchVoices", "Error", e);
            throw e;
        }
    }
}