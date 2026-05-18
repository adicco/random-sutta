// Path: web/assets/modules/ui/components/parallels/parallels_data.js
import { SuttaRepository } from 'data/sutta_repository.js';
import { getLogger } from 'utils/logger.js';
import { Scroller } from 'ui/common/scroller.js';
import { Router } from 'core/router.js';
import { FilterComponent } from 'ui/components/filters/index.js';

const logger = getLogger("ParallelsData");

export const ParallelsData = {
    async load(suttaId, listElement) {
        if (!listElement) return false;
        listElement.innerHTML = '';
        
        if (!suttaId) {
            listElement.innerHTML = '<li class="parallels-item"><div class="parallels-header-row"><span class="parallels-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels data available.</span></div></li>';
            return false;
        }

        const parallelsData = await SuttaRepository.getParallels(suttaId);
        if (!parallelsData || Object.keys(parallelsData).length === 0) {
            listElement.innerHTML = '<li class="parallels-item"><div class="parallels-header-row"><span class="parallels-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels found.</span></div></li>';
            return false;
        }

        // Collect all target UIDs (stripping segment IDs) to fetch their titles
        const targetUids = new Set();
        Object.values(parallelsData).forEach(segmentData => {
            Object.values(segmentData).forEach(list => {
                list.forEach(target => {
                    const cleanUid = target.split('#')[0];
                    targetUids.add(cleanUid);
                });
            });
        });
        
        // Fetch metadata for titles
        const metadata = await SuttaRepository.fetchMetaList([...targetUids]);

        // Render sections in order
        const RELATION_ORDER = ["parallels", "resembles", "mentions", "retells"];
        let html = '';

        // Helper to format a link
        const createLinkHtml = (target) => {
            const hashIndex = target.indexOf('#');
            const cleanUid = hashIndex !== -1 ? target.substring(0, hashIndex) : target;
            const segmentSuffix = hashIndex !== -1 ? target.substring(hashIndex) : '';
            
            const meta = metadata[cleanUid];
            const acronym = meta ? meta.acronym : cleanUid;
            const title = meta ? (meta.translated_title || meta.original_title || "") : "";
            
            // [UPDATED] Use normalized action format
            const action = `window.loadSutta('${target}')`;

            return `
                <li class="parallels-item">
                    <a class="parallels-link" onclick="${action}; return false;">
                        <span class="parallels-acronym">${acronym}${segmentSuffix}</span>
                        <span class="parallels-title">${title}</span>
                    </a>
                </li>
            `;
        };

        // 1. Render Sutta-level relations first (key == suttaId)
        if (parallelsData[suttaId]) {
            RELATION_ORDER.forEach(relType => {
                if (parallelsData[suttaId][relType] && parallelsData[suttaId][relType].length > 0) {
                    const sectionTitle = relType.charAt(0).toUpperCase() + relType.slice(1);
                    html += `
                        <li class="parallels-item" style="margin-top: 10px;">
                            <h4 class="parallels-group-header">${sectionTitle}</h4>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                    `;
                    parallelsData[suttaId][relType].forEach(target => {
                        html += createLinkHtml(target);
                    });
                    html += `</ul></li>`;
                }
            });
        }

        // 2. Render Segment-level relations
        const segmentKeys = Object.keys(parallelsData).filter(k => k !== suttaId);
        // Sort segment keys (e.g. by order if numeric, otherwise alphabetical)
        segmentKeys.sort((a, b) => {
            const aNum = parseFloat(a.split('#')[1]);
            const bNum = parseFloat(b.split('#')[1]);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.localeCompare(b);
        });

        if (segmentKeys.length > 0) {
            html += `
                <li class="parallels-item" style="margin-top: 20px;">
                    <h4 class="parallels-group-header" style="color: var(--primary-color);">By Segment</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">
            `;
            
            segmentKeys.forEach(segKey => {
                // [FIX] Correctly extract range label
                const hashIndex = segKey.indexOf('#');
                let segLabel = hashIndex !== -1 ? segKey.substring(hashIndex + 1) : segKey;
                segLabel = segLabel.replace(/#/g, ''); // Clean up internal hashes if any

                // [FIX] Prepare jump/highlight data
                let startId = segKey;
                let endId = null;
                if (segKey.includes('-')) {
                    const parts = segKey.split('-');
                    startId = parts[0];
                    endId = parts[1].replace(/^#/, '');
                }

                // Normalize IDs
                const normStart = document.getElementById(startId.split('#')[1] || "") ? (startId.split('#')[1]) : startId.replace('#', ':');
                const normEnd = endId ? (document.getElementById(endId) ? endId : (endId.includes(':') ? endId : `${suttaId}:${endId}`)) : null;

                html += `
                    <li class="parallels-item parallels-segment-group">
                        <div class="parallels-segment-header" data-start="${normStart}" data-end="${normEnd || ''}" title="Jump to segment">Seg ${segLabel}</div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                `;                
                RELATION_ORDER.forEach(relType => {
                    if (parallelsData[segKey][relType] && parallelsData[segKey][relType].length > 0) {
                         html += `<div class="parallels-type-label">${relType}</div>`;
                         parallelsData[segKey][relType].forEach(target => {
                            html += createLinkHtml(target);
                        });
                    }
                });
                
                html += `</ul></li>`;
            });
            html += `</ul></li>`;
        }

        listElement.innerHTML = html;

        // Bind segment click events for jumping and highlighting
        listElement.querySelectorAll('.parallels-segment-header').forEach(header => {
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                const startId = header.dataset.start;
                const endId = header.dataset.end || null;
                
                // 1. Prepare search patterns
                const escapedStart = startId.replace(/:/g, '\\:').replace(/\./g, '\\.');
                const startEl = document.getElementById(startId);

                // 2. Execute Jump and Highlight
                if (startEl) {
                    Scroller.jumpTo(startId);
                    Scroller.highlightElement(startId, true, endId); // Use auto-remove for UI feedback
                    
                    // Update URL hash to match jump target
                    try {
                        const bookParam = FilterComponent.generateBookParam();
                        const hlParam = endId ? `${startId}-${endId}` : startId;
                        Router.updateURL(suttaId, bookParam, false, startId, Scroller.getScrollTop(), { replace: true, hl: hlParam });
                    } catch (err) {
                        logger.warn("Failed to update URL on jump", err);
                    }
                } else {
                    logger.warn(`Could not find start segment: ${startId}`);
                }
            });
        });
        
        return true;
    }
};