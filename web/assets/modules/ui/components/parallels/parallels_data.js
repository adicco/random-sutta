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

        // [NEW] Handle Parent Fallback (for Subleafs)
        const effectiveUid = parallelsData._parentUid || suttaId;

        // Collect all target UIDs (stripping segment IDs) to fetch their titles
        const targetUids = new Set();
        Object.keys(parallelsData).forEach(key => {
            if (key.startsWith('_')) return; // Skip metadata like _parentUid
            const segmentData = parallelsData[key];
            Object.values(segmentData).forEach(list => {
                list.forEach(target => {
                    const cleanUid = target.split('#')[0];
                    targetUids.add(cleanUid);
                });
            });
        });
        
        // Fetch metadata for titles
        const metadata = await SuttaRepository.fetchMetaList([...targetUids]);

        // Helper to sort targets by language: pli > lzh > others
        const sortTargetsByLang = (targets) => {
            return [...targets].sort((a, b) => {
                const uidA = a.split('#')[0];
                const uidB = b.split('#')[0];
                const langA = metadata[uidA]?.root_lang || "";
                const langB = metadata[uidB]?.root_lang || "";

                const getLangPriority = (lang) => {
                    if (lang === 'pli') return 0;
                    if (lang === 'lzh') return 1;
                    if (lang === 'san') return 2;
                    if (lang === 'pra') return 3;
                    return 4;
                };

                const pA = getLangPriority(langA);
                const pB = getLangPriority(langB);

                if (pA !== pB) return pA - pB;
                
                // If priorities are equal (both in "others" category), sort by language code first
                if (pA === 4 && langA !== langB) {
                    return langA.localeCompare(langB);
                }
                
                return a.localeCompare(b);
            });
        };

        // Render sections in order
        const RELATION_ORDER = ["parallels", "resembles", "mentions", "retells"];
        let suttaHtml = '';
        let segmentsHtml = '';

        // Helper to format a link
        const createLinkHtml = (target) => {
            const hashIndex = target.indexOf('#');
            const cleanUid = hashIndex !== -1 ? target.substring(0, hashIndex) : target;
            const segmentSuffix = hashIndex !== -1 ? target.substring(hashIndex) : '';
            
            const meta = metadata[cleanUid];
            const acronym = meta ? meta.acronym : cleanUid;
            const title = meta ? (meta.translated_title || meta.original_title || "") : "";
            const rootLang = meta ? (meta.root_lang || "") : "";
            
            return `
                <li class="parallels-item">
                    <a class="parallels-link" data-target="${target}">
                        ${rootLang ? `<span class="parallels-root-lang">${rootLang}</span>` : ''}
                        <span class="parallels-acronym">${acronym}${segmentSuffix}</span>
                        <span class="parallels-title">${title}</span>
                    </a>
                </li>
            `;
        };

        // 1. Prepare Sutta-level relations
        if (parallelsData[effectiveUid]) {
            let hasSuttaContent = false;
            let tempSuttaHtml = '';

            RELATION_ORDER.forEach(relType => {
                if (parallelsData[effectiveUid][relType] && parallelsData[effectiveUid][relType].length > 0) {
                    const sectionTitle = relType.charAt(0).toUpperCase() + relType.slice(1);
                    tempSuttaHtml += `
                        <li class="parallels-item" style="margin-top: 10px;">
                            <h4 class="parallels-group-header">${sectionTitle}</h4>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                    `;
                    const sortedTargets = sortTargetsByLang(parallelsData[effectiveUid][relType]);
                    sortedTargets.forEach(target => {
                        tempSuttaHtml += createLinkHtml(target);
                    });
                    tempSuttaHtml += `</ul></li>`;
                    hasSuttaContent = true;
                }
            });

            if (hasSuttaContent) {
                // Determine heading based on whether we are in a subleaf
                const isSubleaf = effectiveUid !== suttaId;
                
                if (isSubleaf) {
                    const parentMeta = await SuttaRepository.fetchMetaList([effectiveUid]);
                    const parentAcronym = parentMeta[effectiveUid]?.acronym || effectiveUid.toUpperCase();
                    const suttaHeading = `${parentAcronym} Parallels (Full)`;

                    suttaHtml = `
                        <li class="parallels-item" style="margin-top: 25px;">
                            <h4 class="parallels-group-header" style="color: var(--primary-color); text-align: center; border-bottom: 2px solid var(--border-light);">${suttaHeading}</h4>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${tempSuttaHtml}
                            </ul>
                        </li>
                    `;
                } else {
                    // For leaves, just show relations directly without the redundant "Sutta Parallels" header
                    suttaHtml = tempSuttaHtml;
                }
            }
        }

        // 2. Prepare Segment-level relations
        const segmentKeys = Object.keys(parallelsData).filter(k => k !== effectiveUid && !k.startsWith('_'));
        // Sort segment keys
        segmentKeys.sort((a, b) => {
            const aNum = parseFloat(a.split('#')[1]);
            const bNum = parseFloat(b.split('#')[1]);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.localeCompare(b);
        });

        if (segmentKeys.length > 0) {
            let hasSegmentContent = false;
            let tempSegmentsHtml = '';
            
            segmentKeys.forEach(segKey => {
                // Filter: Only show segments present in current DOM
                const domId = segKey.replace('#', ':');
                if (!document.getElementById(domId)) return;

                // [FIX] Correctly extract range label
                const hashIndex = segKey.indexOf('#');
                let segLabel = hashIndex !== -1 ? segKey.substring(hashIndex + 1) : segKey;
                segLabel = segLabel.replace(/#/g, '');

                // Prepare jump/highlight data
                let startId = segKey;
                let endId = null;
                if (segKey.includes('-')) {
                    const parts = segKey.split('-');
                    startId = parts[0];
                    endId = parts[1].replace(/^#/, '');
                }

                const normStart = document.getElementById(startId.split('#')[1] || "") ? (startId.split('#')[1]) : startId.replace('#', ':');
                const normEnd = endId ? (document.getElementById(endId) ? endId : (endId.includes(':') ? endId : `${suttaId}:${endId}`)) : null;

                tempSegmentsHtml += `
                    <li class="parallels-item parallels-segment-group">
                        <div class="parallels-segment-header" data-start="${normStart}" data-end="${normEnd || ''}" title="Jump to segment">Seg ${segLabel}</div>
                        <ul class="parallels-segment-list">
                `;                
                RELATION_ORDER.forEach(relType => {
                    if (parallelsData[segKey][relType] && parallelsData[segKey][relType].length > 0) {
                         tempSegmentsHtml += `<div class="parallels-type-label">${relType}</div>`;
                         const sortedTargets = sortTargetsByLang(parallelsData[segKey][relType]);
                         sortedTargets.forEach(target => {
                            tempSegmentsHtml += createLinkHtml(target);
                        });
                    }
                });
                tempSegmentsHtml += `</ul></li>`;
                hasSegmentContent = true;
            });

            if (hasSegmentContent) {
                const isSubleaf = effectiveUid !== suttaId;
                const topMargin = isSubleaf ? "" : "margin-top: 25px;";
                const headerHtml = isSubleaf ? "" : `<h4 class="parallels-group-header" style="color: var(--primary-color); text-align: center; border-bottom: 2px solid var(--border-light);">By Segment</h4>`;

                segmentsHtml = `
                    <li class="parallels-item" style="${topMargin}">
                        ${headerHtml}
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${tempSegmentsHtml}
                        </ul>
                    </li>
                `;
            }
        }

        // Assemble Final HTML
        // If it's a subleaf, show segments first
        if (effectiveUid !== suttaId) {
            listElement.innerHTML = segmentsHtml + suttaHtml;
        } else {
            listElement.innerHTML = suttaHtml + segmentsHtml;
        }

        if (!suttaHtml && !segmentsHtml) {
             listElement.innerHTML = '<li class="parallels-item"><div class="parallels-header-row"><span class="parallels-main-text" style="text-align: center; color: var(--text-muted); font-weight: normal; font-size: 0.9em; padding: 15px;">No parallels found on this page.</span></div></li>';
             return false;
        }

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