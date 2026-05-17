// Path: web/assets/modules/ui/components/toh/toh_parallels.js
import { SuttaRepository } from 'data/sutta_repository.js';
import { getLogger } from 'utils/logger.js';
import { Scroller } from 'ui/common/scroller.js';

const logger = getLogger("TOH_Parallels");

export const TohParallels = {
    async load(suttaId, listElement) {
        if (!listElement) return;
        listElement.innerHTML = '';
        
        if (!suttaId) {
            listElement.innerHTML = '<li class="toh-item"><div class="toh-header-row"><span class="toh-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels data available.</span></div></li>';
            return;
        }

        const parallelsData = await SuttaRepository.getParallels(suttaId);
        if (!parallelsData || Object.keys(parallelsData).length === 0) {
            listElement.innerHTML = '<li class="toh-item"><div class="toh-header-row"><span class="toh-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels found.</span></div></li>';
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
                <li class="toh-item">
                    <a class="toh-parallel-link" onclick="window.loadSutta('${target}'); return false;">
                        <span class="toh-parallel-acronym">${acronym}${segmentSuffix}</span>
                        <span class="toh-parallel-title">${title}</span>
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
                        <li class="toh-item" style="margin-top: 10px;">
                            <h4 class="toh-group-header">${sectionTitle}</h4>
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
                <li class="toh-item" style="margin-top: 20px;">
                    <h4 class="toh-group-header" style="color: var(--primary-color);">By Segment</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">
            `;
            
            segmentKeys.forEach(segKey => {
                const segLabel = segKey.split('#')[1] || segKey;
                const elementPrefix = segKey.replace('#', ':'); // Match HTML segment ID format (e.g. dn1:1.6.3)
                
                html += `
                    <li class="toh-item toh-segment-group">
                        <div class="toh-segment-header" data-prefix="${elementPrefix}" title="Jump to segment">Seg ${segLabel}</div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                `;
                
                RELATION_ORDER.forEach(relType => {
                    if (parallelsData[segKey][relType] && parallelsData[segKey][relType].length > 0) {
                         html += `<div class="toh-parallel-type-label">${relType}</div>`;
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
        listElement.querySelectorAll('.toh-segment-header').forEach(header => {
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
                    
                    targetArray.forEach(el => {
                        const highlightClass = el.classList.contains('segment') ? 'highlight' : 'highlight-container';
                        el.classList.add(highlightClass);
                        
                        const timerId = setTimeout(() => {
                            el.classList.remove(highlightClass);
                            delete el.dataset.highlightTimer;
                        }, 3500);
                        el.dataset.highlightTimer = timerId;
                    });
                } else {
                    logger.warn(`Could not find segments for: ${prefix}`);
                }
            });
        });
    }
};