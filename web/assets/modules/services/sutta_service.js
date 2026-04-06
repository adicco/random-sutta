import { SuttaRepository } from "data/sutta_repository.js";
import { SuttaExtractor } from "data/sutta_extractor.js";
import { getLogger } from "utils/logger.js";
import { RandomHelper } from "services/random_helper.js";
import { StructureStrategy } from "services/structure_strategy.js";

const logger = getLogger("SuttaService");
// ... (Phần logic còn lại giữ nguyên)
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

        if (hintBook === null) {
            let loc = await SuttaRepository.resolveLocation(uid);
            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            hintBook = loc[0];
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

        // [NEW] Cứu vãn metadata cho các con trực tiếp của Branch
        if (currentNode && currentNode !== "LEAF") {
            const childIds = [];
            const collectDirectChildren = (node) => {
                if (Array.isArray(node)) {
                    node.forEach(c => {
                        if (typeof c === 'string') childIds.push(c);
                        else if (typeof c === 'object') childIds.push(Object.keys(c)[0]);
                    });
                } else if (typeof node === 'object') {
                    childIds.push(...Object.keys(node));
                }
            };
            collectDirectChildren(currentNode);

            const missingChildIds = childIds.filter(id => !finalContextMeta[id] && !bookMeta.meta[id]);
            if (missingChildIds.length > 0) {
                logger.debug("loadSutta", `Fetching missing metadata for ${missingChildIds.length} children of ${uid}`);
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
        if (!content && metaEntry.parent_uid) {
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
            
            if (options.prefetchNav) {
                neighborsToFetch.forEach(neighborUid => {
                     this.loadSutta(neighborUid, { prefetchNav: false })
                        .catch(e => logger.warn("Prefetch", `Failed to prefetch ${neighborUid}`));
                });
            }
        }
        
        if (options.prefetchNav) {
             [nav.prev, nav.next].forEach(nid => {
                 if (nid && bookMeta.meta[nid]) { 
                     this.loadSutta(nid, { prefetchNav: false }).catch(() => {});
                 }
             });
        }

        return {
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
    }
};
