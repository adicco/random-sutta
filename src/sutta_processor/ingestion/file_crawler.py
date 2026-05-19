# Path: src/sutta_processor/ingestion/file_crawler.py
import logging
import json
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

# [UPDATED]
from ..shared.app_config import (
    RAW_BILARA_DIR, 
    RAW_STRUCTURE_DIR,
    RAW_ROOT_DIRS, 
    RAW_HTML_DIRS, 
    RAW_TRANS_DIRS, 
    RAW_COMMENT_DIRS,
    RAW_VARIANT_DIRS, 
    RAW_REFERENCE_DIRS
)

logger = logging.getLogger("SuttaProcessor.Ingestion.Crawler")

EXTRA_BOOKS = {
    "pli-tv-bi-pm": "vinaya/pli-tv-bi-pm",
    "pli-tv-bu-pm": "vinaya/pli-tv-bu-pm"
}

def _build_file_indices() -> Tuple[Dict[str, Path], Dict[str, Dict[str, Path]], Dict[str, Path], Dict[str, Path], Dict[str, Path], Dict[str, Path]]:
    """
    Scans the raw data directories ONCE to build lookup maps for all file types.
    Strategy: The lists in config are ordered [bilara_more, suttacentral_bilara]. 
    If a file exists in multiple paths, the latter one will overwrite the former, 
    prioritizing SuttaCentral's official data over our custom conversion.
    """
    logger.info("⚡ Indexing ALL raw files (Root, Trans, HTML, Comment, Variant, Reference)...")
    
    root_index = {}
    trans_index = {}
    html_index = {}
    comment_index = {}
    variant_index = {}
    reference_index = {}

    # 1. Index Root Files
    for d in RAW_ROOT_DIRS:
        if d.exists():
            for file_path in d.rglob("*_root-*.json"):
                if file_path.is_file():
                    sutta_id = file_path.name.split("_")[0]
                    root_index[sutta_id] = file_path

    # 2. Index Translation Files
    for d in RAW_TRANS_DIRS:
        if d.exists():
            for file_path in d.rglob("*_translation-*.json"):
                if file_path.is_file():
                    parts = file_path.name.replace(".json", "").split("_")
                    if len(parts) >= 2:
                        sutta_id = parts[0]
                        suffix_parts = parts[1].split("-")
                        if len(suffix_parts) >= 3:
                            author_uid = suffix_parts[2]
                            if sutta_id not in trans_index: trans_index[sutta_id] = {}
                            trans_index[sutta_id][author_uid] = file_path

    # 3. Index HTML Files
    for d in RAW_HTML_DIRS:
        if d.exists():
            for file_path in d.rglob("*_html.json"):
                 if file_path.is_file():
                    sutta_id = file_path.name.split("_")[0]
                    html_index[sutta_id] = file_path

    # 4. Index Comment Files
    for d in RAW_COMMENT_DIRS:
        if d.exists():
            for file_path in d.rglob("*_comment-*.json"):
                if file_path.is_file():
                    sutta_id = file_path.name.split("_")[0]
                    comment_index[sutta_id] = file_path

    # 5. Index Variant Files
    for d in RAW_VARIANT_DIRS:
        if d.exists():
            for file_path in d.rglob("*_variant-*.json"):
                if file_path.is_file():
                    sutta_id = file_path.name.split("_")[0]
                    variant_index[sutta_id] = file_path

    # 6. Index Reference Files
    for d in RAW_REFERENCE_DIRS:
        if d.exists():
            for file_path in d.rglob("*_reference.json"):
                if file_path.is_file():
                    sutta_id = file_path.name.split("_")[0]
                    reference_index[sutta_id] = file_path

    return root_index, trans_index, html_index, comment_index, variant_index, reference_index

def _identify_book_group_from_tree(tree_file: Path) -> str:
    try:
        # [UPDATED] Use RAW_STRUCTURE_DIR
        base_tree = RAW_STRUCTURE_DIR / "tree"
        rel_path = tree_file.relative_to(base_tree)
        parent = rel_path.parent
        book_id = tree_file.name.replace("-tree.json", "")
        return f"{parent}/{book_id}"
    except Exception:
        return "uncategorized"

def _extract_leaves_from_tree(node: Any) -> List[str]:
    leaves = []
    if isinstance(node, str): return [node]
    elif isinstance(node, list):
        for child in node: leaves.extend(_extract_leaves_from_tree(child))
    elif isinstance(node, dict):
        for key, children in node.items(): leaves.extend(_extract_leaves_from_tree(children))
    return leaves

def _get_priority_score(group_name: str) -> int:
    if group_name.startswith("sutta"): return 0
    if group_name.startswith("vinaya"): return 1
    if group_name.startswith("abhidhamma"): return 2
    return 3

def generate_book_tasks(meta_map: Dict[str, Any]) -> Tuple[Dict[str, List[Tuple]], Dict[str, str]]:
    # [UPDATED] Scan structure/tree
    tree_dir = RAW_STRUCTURE_DIR / "tree"
    if not tree_dir.exists():
        logger.warning(f"Tree directory missing: {tree_dir}")
        return {}, {}

    # Build comprehensive indices once
    root_index, trans_index, html_index, comment_index, variant_index, reference_index = _build_file_indices()
    
    logger.info(f"🌲 Scanning Tree files...")
    
    raw_tasks_list: List[Tuple[str, List[Tuple]]] = []
    total_suttas = 0
    all_discovered_map = {} # [NEW] { book_id: group_id }
    
    tree_files = sorted(list(tree_dir.rglob("*-tree.json")))
    
    for tree_file in tree_files:
        if tree_file.name == "super-tree.json": continue
        group_id = _identify_book_group_from_tree(tree_file)
        book_id = tree_file.name.replace("-tree.json", "")
        all_discovered_map[book_id] = group_id
        
        try:
            with open(tree_file, "r", encoding="utf-8") as f:
                tree_data = json.load(f)
            ordered_uids = _extract_leaves_from_tree(tree_data)
            
            tasks = []
            for uid in ordered_uids:
                if uid in root_index:
                    root_path = root_index[uid]
                    author_uid = None
                    if uid in meta_map:
                        author_uid = meta_map[uid].get("best_author_uid")
                    
                    # Resolve paths immediately
                    html_path = html_index.get(uid)
                    comment_path = comment_index.get(uid)
                    variant_path = variant_index.get(uid)
                    reference_path = reference_index.get(uid)
                    
                    trans_path = None
                    if author_uid and uid in trans_index:
                        trans_path = trans_index[uid].get(author_uid)

                    # Expanded Tuple
                    tasks.append((uid, root_path, trans_path, html_path, comment_path, variant_path, reference_path, author_uid))
            
            if tasks:
                raw_tasks_list.append((group_id, tasks))
                total_suttas += len(tasks)
        except Exception as e:
            logger.error(f"Error parsing tree {tree_file.name}: {e}")

    for book_id, group_name in EXTRA_BOOKS.items():
        if book_id in root_index:
            logger.info(f"   ➕ Injecting extra book: {group_name}")
            all_discovered_map[book_id] = group_name
            root_path = root_index[book_id]
            author_uid = meta_map.get(book_id, {}).get("best_author_uid")
            
            html_path = html_index.get(book_id)
            comment_path = comment_index.get(book_id)
            variant_path = variant_index.get(book_id)
            reference_path = reference_index.get(book_id)
            
            trans_path = None
            if author_uid and book_id in trans_index:
                trans_path = trans_index[book_id].get(author_uid)
            
            tasks = [(book_id, root_path, trans_path, html_path, comment_path, variant_path, reference_path, author_uid)]
            raw_tasks_list.append((group_name, tasks))
            total_suttas += 1

    raw_tasks_list.sort(key=lambda x: _get_priority_score(x[0]))
    book_tasks = {k: v for k, v in raw_tasks_list}

    logger.info(f"✅ Generated tasks for {total_suttas} suttas (Sorted by Priority).")
    return book_tasks, all_discovered_map
