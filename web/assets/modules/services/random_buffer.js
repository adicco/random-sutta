// Path: web/assets/modules/services/random_buffer.js
import { AppConfig } from 'core/app_config.js';
import { RandomHelper } from './random_helper.js';
import { SuttaService } from './sutta_service.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("RandomBuffer");

export const RandomBuffer = {
    _buffer: [],
    _isRefilling: false,
    _refillTimer: null, 

    startBackgroundWork() {
        if (this._isRefilling) return;
        this._isRefilling = true;
        logger.info("Buffer", "Starting background buffering...");
        this._fillBuffer();
    },

    async getPayload(activeFilters) {
        // ... (Giữ nguyên logic filter cũ) ...
        if (activeFilters && activeFilters.length > 0) {
            const originalLength = this._buffer.length;
            this._buffer = this._buffer.filter(item => {
                // [FIXED] Truy cập uid thông qua item.payload
                const uid = item.payload?.uid || item.uid; 
                if (!uid) return false;
                
                const match = uid.match(/^[a-z]+/i);
                const bookId = match ? match[0].toLowerCase() : '';
                return activeFilters.includes(bookId);
            });
            if (this._buffer.length < originalLength) {
                logger.info("Buffer", `Cleaned ${originalLength - this._buffer.length} stale items.`);
            }
        }

        if (this._buffer.length > 0) {
            const item = this._buffer.pop();
            logger.info("Random", `Served from Buffer: ${item.uid} (Remaining: ${this._buffer.length})`);
            
            this._scheduleRefill(activeFilters);
            return item;
        }

        logger.info("Random", "Buffer empty, fetching directly...");
        // [DEBUG] Log time for direct fetch
        const start = performance.now();
        const payload = await RandomHelper.getRandomPayload(activeFilters);
        const end = performance.now();
        logger.debug("Random", `Direct calculation took ${(end - start).toFixed(2)}ms`);

        this._scheduleRefill(activeFilters);
        return payload;
    },

    // [UPDATED] Helper Debounce
    _scheduleRefill(filters) {
        if (this._refillTimer) {
            clearTimeout(this._refillTimer);
            this._refillTimer = null;
        }

        // Reduced delay to 300ms for more aggressive refilling
        this._refillTimer = setTimeout(() => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => this._fillBuffer(filters), { timeout: 1000 });
            } else {
                this._fillBuffer(filters);
            }
            this._refillTimer = null;
        }, 300);
    },

    async _fillBuffer(filters = null) {
        if (this._buffer.length >= AppConfig.BUFFER_SIZE) return;
        try {
            const payload = await RandomHelper.getRandomPayload(filters);
            if (!payload) return;

            // [PERF] Background buffer now stores the FULL processed data object
            const result = await SuttaService.loadSutta(payload.uid, { prefetchNav: false });
            if (result) {
                // Đóng gói cả payload và data xử lý xong
                this._buffer.push({
                    payload: payload,
                    data: result
                });
                logger.debug("Buffer", `Buffered: ${payload.uid} (Size: ${this._buffer.length})`);
            } else {
                logger.warn("Buffer", `Skipped invalid item: ${payload.uid}`);
            }
            
            if (this._buffer.length < AppConfig.BUFFER_SIZE) {
               if ('requestIdleCallback' in window) {
                     requestIdleCallback(() => this._fillBuffer(filters));
               } else {
                     setTimeout(() => this._fillBuffer(filters), 100);
               }
            }
        } catch (e) {
            logger.warn("Buffer", "Failed to buffer random sutta", e);
        }
    }
};