// Path: web/assets/modules/ui/components/parallels/parallels_data.js
import { SuttaRepository } from 'data/sutta_repository.js';
import { getLogger } from 'utils/logger.js';
import { Scroller } from 'ui/common/scroller.js';
import { Router } from 'core/router.js';
import { FilterComponent } from 'ui/components/filters/index.js';

const logger = getLogger("ParallelsData");

export const ParallelsData = {
    async load(suttaId, listElement) {
        if (!listElement) return;
        listElement.innerHTML = '';
        
        if (!suttaId) {
            listElement.innerHTML = '<li class="parallels-item"><div class="parallels-header-row"><span class="parallels-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels data available.</span></div></li>';
            return;
        }

        const parallelsData = await SuttaRepository.getParallels(suttaId);
        if (!parallelsData || Object.keys(parallelsData).length === 0) {
            listElement.innerHTML = '<li class="parallels-item"><div class="parallels-header-row"><span class="parallels-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels found.</span></div></li>';
            return;
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
            const cleanUid = target.split('#')[0];
            const segmentSuffix = target.includes('#') ? `#${target.split('#')[1]}` : '';
            
            const meta = metadata[cleanUid];
            const acronym = meta ? meta.acronym : cleanUid;
            const title = meta ? (meta.translated_title || meta.original_title || "") : "";
            
            return `
                <li class="parallels-item">
                    <a class="parallels-link" onclick="window.loadSutta('${target}'); return false;">
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
                const segLabel = segKey.split('#')[1] || segKey;

                // [FIX] Priority: Use segment label directly if it exists as an ID in DOM (e.g. vns256)
                // Fallback to prefixed format (e.g. thag3.13:1.1)
                const elementPrefix = document.getElementById(segLabel) ? segLabel : segKey.replace('#', ':');

                html += `
                    <li class="parallels-item parallels-segment-group">
                        <div class="parallels-segment-header" data-prefix="${elementPrefix}" title="Jump to segment">Seg ${segLabel}</div>
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
                const prefix = header.dataset.prefix; // e.g., "dn1:1.7.1"
                
                // 1. Prepare search patterns
                // Escape colons and periods for querySelector
                const escapedPrefix = prefix.replace(/:/g, '\\:').replace(/\./g, '\\.');
                
                // Find all elements that are exactly this ID OR start with this ID followed by a dot
                // This covers both single segments and groups/prefixes.
                const targets = document.querySelectorAll(`#${escapedPrefix}, [id^='${escapedPrefix}.']`);

                // 2. Clear previous highlights
                document.querySelectorAll('.highlight, .highlight-container').forEach(el => {
                    el.classList.remove('highlight', 'highlight-container');
                    if (el.dataset.highlightTimer) {
                        clearTimeout(parseInt(el.dataset.highlightTimer));
                        delete el.dataset.highlightTimer;
                    }
                });

                // 3. Execute Jump and Highlight
                if (targets.length > 0) {
                    // Convert to Array and sort by ID numeric value if possible
                    const targetArray = Array.from(targets).sort((a, b) => 
                        a.id.localeCompare(b.id, undefined, {numeric: true, sensitivity: 'base'})
                    );
                    
                    const firstEl = targetArray[0];
                    Scroller.jumpTo(firstEl.id);
                    
                    // Update URL hash to match jump target
                    try {
                        const bookParam = FilterComponent.generateBookParam();
                        Router.updateURL(suttaId, bookParam, false, firstEl.id);
                    } catch (err) {
                        logger.warn("Failed to update URL on jump", err);
                    }
                    
                    targetArray.forEach(el => {
                        // [FIX] If targeting a reference anchor, highlight the parent segment instead
                        let highlightEl = el;
                        if (el.classList.contains('anchor-ref')) {
                            highlightEl = el.closest('.segment') || el;
                        }

                        const highlightClass = highlightEl.classList.contains('segment') ? 'highlight' : 'highlight-container';
                        highlightEl.classList.add(highlightClass);
                        
                        const timerId = setTimeout(() => {
                            highlightEl.classList.remove(highlightClass);
                            delete highlightEl.dataset.highlightTimer;
                        }, 3500);
                        highlightEl.dataset.highlightTimer = timerId;
                    });
                } else {
                    logger.warn(`Could not find segments for: ${prefix}`);
                }
            });
        });
    }
};