import { SuttaRepository } from "data/sutta_repository.js";
import { SuttaExtractor } from "data/sutta_extractor.js";
import { getLogger } from "utils/logger.js";
import { RandomHelper } from "services/random_helper.js";
import { StructureStrategy } from "services/structure_strategy.js";

const logger = getLogger("SuttaService");

// --- IN-MEMORY CACHE (Shared across App) ---
const SUTTA_CACHE = new Map(); // UID -> Processed Data Object
const MAX_CACHE_SIZE = 10;

function addToCache(uid, data) {
    if (!uid || !data) return;
    if (SUTTA_CACHE.has(uid)) SUTTA_CACHE.delete(uid); // Refresh position
    SUTTA_CACHE.set(uid, data);
    
    if (SUTTA_CACHE.size > MAX_CACHE_SIZE) {
        const firstKey = SUTTA_CACHE.keys().next().value;
        SUTTA_CACHE.delete(firstKey);
    }
}

let _tpkCache = null;

function findNodeInTree(structure, targetId) {
    if (!structure) return null;
    if (Array.isArray(structure)) {
        for (const child of structure) {
            if (typeof child === 'string') {
                if (child === targetId) return "LEAF";
            } else {
                const res = findNodeInTree(child, targetId);
                if (res) return res;
            }
        }
        return null;
    }
    if (typeof structure === 'object') {
        if (structure[targetId]) return structure[targetId];
        for (const key in structure) {
            const res = findNodeInTree(structure[key], targetId);
            if (res) return res;
        }
    }
    return null;
}

function getSingleChildTarget(nodeContent) {
    if (!nodeContent || nodeContent === "LEAF") return null;
    if (Array.isArray(nodeContent) && nodeContent.length === 1) {
        const child = nodeContent[0];
        if (typeof child === 'string') return child;
        if (typeof child === 'object') {
            const keys = Object.keys(child);
            if (keys.length === 1) return keys[0];
        }
    }
    
    if (typeof nodeContent === 'object' && !Array.isArray(nodeContent)) {
        const keys = Object.keys(nodeContent);
        if (keys.length === 1) {
             const childVal = nodeContent[keys[0]];
             return getSingleChildTarget(childVal) ? keys[0] : null; 
        }
    }

    return null;
}

export const SuttaService = {
    async init() {
        await SuttaRepository.init();
        RandomHelper.init(); 
    },

    async loadSutta(input, options = { prefetchNav: true }) {
        let uid, hintBook = null;
        if (typeof input === 'object') {
            uid = input.uid;
            hintBook = input.book_id || null;
        } else {
            uid = input;
        }

        // 0. Check Cache First
        if (SUTTA_CACHE.has(uid)) {
            const cached = SUTTA_CACHE.get(uid);
            if (options.prefetchNav && cached.nav) {
                this._prefetchNeighbors(cached.nav);
            }
            return cached;
        }

        if (hintBook === null) {
            let loc = await SuttaRepository.resolveLocation(uid);
            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            hintBook = loc[0];
            uid = loc[1]; // Use canonical UID
        }

        const isFileProtocol = window.location.protocol === 'file:';
        const isOfflineReady = !!localStorage.getItem('sutta_offline_version');
        const isOfflineBuild = !!window.__DB_INDEX__;

        const shouldMergeTree = isFileProtocol || isOfflineReady || isOfflineBuild;

        let tpkPromise;
        if (_tpkCache) {
            tpkPromise = Promise.resolve(_tpkCache);
        } else {
            tpkPromise = SuttaRepository.fetchMeta('tpk').then(data => {
                if (data) _tpkCache = data;
                return data;
            }).catch(() => null);
        }

        const timerId = Math.random().toString(36).substr(2, 5);
        const fetchLabel = `Data Fetch (${uid}) [${timerId}]`;
        logger.timer(fetchLabel);

        const [bookMeta, superMeta] = await Promise.all([
            SuttaRepository.fetchMeta(hintBook),
            tpkPromise 
        ]);
        
        logger.timerEnd(fetchLabel);

        if (!bookMeta) return null;
        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        if (metaEntry.type === 'alias') {
            return { 
                isAlias: true, 
                targetUid: metaEntry.target_uid,
                hashId: metaEntry.hash_id 
            };
        }

        const { tree: finalTree, contextMeta: finalContextMeta } = 
            await StructureStrategy.resolveContext(bookMeta, uid, shouldMergeTree);
        const currentNode = findNodeInTree(finalTree, uid);

        // [NEW] Cứu vãn metadata cho các con trực tiếp của Branch và các node trong chuỗi gộp (Hoisting)
        if (currentNode && currentNode !== "LEAF") {
            const childIds = [];
            const idsToDeepCheck = [];

            const collectDirectChildren = (node) => {
                if (Array.isArray(node)) {
                    node.forEach(c => {
                        let cid = null;
                        if (typeof c === 'string') cid = c;
                        else if (typeof c === 'object') cid = Object.keys(c)[0];
                        
                        if (cid) {
                            childIds.push(cid);
                            idsToDeepCheck.push({ id: cid, content: typeof c === 'object' ? c[cid] : null });
                        }
                    });
                } else if (typeof node === 'object') {
                    for (const cid in node) {
                        childIds.push(cid);
                        idsToDeepCheck.push({ id: cid, content: node[cid] });
                    }
                }
            };
            collectDirectChildren(currentNode);

            // Truy quét thêm 1 cấp cho các chuỗi đơn (Hoisting target)
            for (const item of idsToDeepCheck) {
                const content = item.content;
                if (content && typeof content === 'object') {
                    const keys = Object.keys(content);
                    // Nếu là chuỗi đơn (VD: long -> [dn])
                    if (keys.length === 1 || (Array.isArray(content) && content.length === 1)) {
                        let grandchildId = null;
                        const firstChild = Array.isArray(content) ? content[0] : keys[0];
                        
                        if (typeof firstChild === 'string') grandchildId = firstChild;
                        else if (typeof firstChild === 'object') grandchildId = Object.keys(firstChild)[0];
                        
                        if (grandchildId) childIds.push(grandchildId);
                    }
                }
            }

            const missingChildIds = [...new Set(childIds)].filter(id => !finalContextMeta[id] && !bookMeta.meta[id]);
            if (missingChildIds.length > 0) {
                logger.debug("loadSutta", `Fetching missing metadata for ${missingChildIds.length} IDs (including hoisting targets)`);
                const extraMeta = await SuttaRepository.fetchMetaList(missingChildIds);
                Object.assign(finalContextMeta, extraMeta);
            }
        }

        const singleChildTarget = getSingleChildTarget(currentNode);

        if (singleChildTarget && singleChildTarget !== uid) {
            logger.info("loadSutta", `Auto-redirecting single chain: ${uid} -> ${singleChildTarget}`);
            return {
                isAlias: true,
                targetUid: singleChildTarget
            };
        }

        let content = await SuttaRepository.fetchContent(uid);
        if (!content && metaEntry.type === 'subleaf' && metaEntry.parent_uid) {
            const parentUid = metaEntry.parent_uid;
            const parentContent = await SuttaRepository.fetchContent(parentUid);
            if (parentContent) {
                const extractKey = metaEntry.extract_id || uid;
                content = SuttaExtractor.extract(parentContent, extractKey);
                if (!content) {
                    logger.error("loadSutta", `Extraction failed. Parent '${parentUid}' found, but extract '${extractKey}' returned null.`);
                }
            } else {
                logger.warn("loadSutta", `Parent '${parentUid}' NOT found.`);
            }
        } else if (!content) {
            if (metaEntry.type === 'leaf' || metaEntry.type === 'subleaf') {
                 logger.warn("loadSutta", `No content for ${uid} and no parent_uid defined.`);
            }
        }

        const nav = metaEntry.nav || {};
        const navMeta = {};
        const neighborsToFetch = [];

        const checkAndAdd = (nid) => {
            if (!nid) return;
            if (bookMeta.meta[nid]) {
                navMeta[nid] = bookMeta.meta[nid];
            } else {
                neighborsToFetch.push(nid);
            }
        };

        checkAndAdd(nav.prev);
        checkAndAdd(nav.next);
        if (neighborsToFetch.length > 0) {
            const extraMeta = await SuttaRepository.fetchMetaList(neighborsToFetch);
            Object.assign(navMeta, extraMeta);
        }
        
        const result = {
            uid: uid,
            meta: metaEntry,
            content: content,
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            
            tree: finalTree, 
            bookStructure: finalTree, 
            contextMeta: finalContextMeta,
            
            superTree: superMeta ? superMeta.tree : null,
            superMeta: superMeta ? superMeta.meta : null,
            
            nav: nav,
            navMeta: navMeta
        };

        // 5. Store in Cache
        addToCache(uid, result);

        // 6. Proactive Prefetching
        if (options.prefetchNav && nav) {
             this._prefetchNeighbors(nav);
        }

        return result;
    },

    _prefetchNeighbors(nav) {
        [nav.prev, nav.next].forEach(nid => {
            if (nid && !SUTTA_CACHE.has(nid)) {
                // Silently load and cache without triggering more prefetches
                this.loadSutta(nid, { prefetchNav: false })
                    .catch(() => {});
            }
        });
    }
};
