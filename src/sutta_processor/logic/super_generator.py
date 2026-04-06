# Path: src/sutta_processor/logic/super_generator.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Set, Optional

from ..shared.app_config import RAW_SUPER_TREE_FILE, RAW_SUPER_META_DIR
# [NEW] Import logic tính nav từ logic layer
from .tree_utils import generate_depth_navigation

logger = logging.getLogger("SuttaProcessor.Logic.SuperGen")

def _load_json(path: Path) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"⚠️ Failed to load {path.name}: {e}")
        return None

def _prune_tree(node: Any, allowed_books: Set[str]) -> Any:
    if isinstance(node, str):
        return node if node in allowed_books else None

    if isinstance(node, list):
        new_list = []
        for item in node:
            pruned_item = _prune_tree(item, allowed_books)
            if pruned_item is not None:
                new_list.append(pruned_item)
        return new_list if new_list else None

    if isinstance(node, dict):
        if "dharmapadas" in node:
            return None
            
        new_dict = {}
        for key, value in node.items():
            pruned_value = _prune_tree(value, allowed_books)
            if pruned_value is not None:
                new_dict[key] = pruned_value
        return new_dict if new_dict else None

    return None

def _flatten_keys(node: Any, collected_keys: Set[str]):
    if isinstance(node, str):
        collected_keys.add(node)
    elif isinstance(node, list):
        for item in node:
            _flatten_keys(item, collected_keys)
    elif isinstance(node, dict):
        for key, value in node.items():
            collected_keys.add(key)
            _flatten_keys(value, collected_keys)

def _load_super_metadata(valid_keys: Set[str]) -> Dict[str, Any]:
    merged_meta = {}
    
    # 1. Thử load từ các file meta chính (tốc độ cao)
    target_files = ["sutta.json", "vinaya.json", "abhidhamma.json"]
    for fname in target_files:
        fpath = RAW_SUPER_META_DIR / fname
        if not fpath.exists(): continue
        raw_data = _load_json(fpath)
        if not raw_data or not isinstance(raw_data, list): continue
        for item in raw_data:
            uid = item.get("uid")
            if uid in valid_keys:
                merged_meta[uid] = {
                    "uid": uid,
                    "type": item.get("type", "group"),
                    "acronym": item.get("acronym", ""),
                    "translated_title": item.get("translated_title", ""),
                    "original_title": item.get("original_title", ""),
                    "blurb": item.get("blurb", None)
                }

    # 2. Kiểm tra những key còn thiếu và thử tìm trong RAW_API_JSON_DIR (Deep Search)
    missing_keys = valid_keys - set(merged_meta.keys())
    if missing_keys:
        logger.info(f"   🔍 Searching for {len(missing_keys)} missing meta entries in API data...")
        from ..shared.app_config import RAW_API_JSON_DIR
        for uid in missing_keys:
            # Tìm file JSON tương ứng với UID (vd: dn.json)
            # Lưu ý: Các branch node thường có file JSON riêng hoặc nằm trong file cha
            potential_file = RAW_API_JSON_DIR / f"{uid}.json"
            if potential_file.exists():
                data = _load_json(potential_file)
                if data and isinstance(data, list) and len(data) > 0:
                    item = data[0] # Lấy entry đầu tiên thường là của chính nó
                    merged_meta[uid] = {
                        "uid": uid,
                        "type": item.get("type", "branch"),
                        "acronym": item.get("acronym", ""),
                        "translated_title": item.get("translated_title", ""),
                        "original_title": item.get("original_title", ""),
                        "blurb": item.get("blurb", None)
                    }
    
    return merged_meta

def precalculate_super_navigation(available_book_ids: List[str]) -> Dict[str, Dict[str, str]]:
    """
    [NEW] Tính toán trước Navigation Map của Super Book dựa trên danh sách sách có sẵn.
    Hàm này được gọi ĐẦU TIÊN bởi BuildManager để lấy nav cho các root book.
    """
    if not RAW_SUPER_TREE_FILE.exists():
        logger.warning(f"⚠️ Super tree missing at {RAW_SUPER_TREE_FILE}. Cannot pre-calc nav.")
        return {}

    logger.info("🔮 Pre-calculating Super Navigation...")
    
    raw_tree = _load_json(RAW_SUPER_TREE_FILE)
    if not raw_tree: return {}

    # 1. Prune tree giả lập dựa trên danh sách sách dự kiến
    allowed_set = set(available_book_ids)
    final_structure = _prune_tree(raw_tree, allowed_set)
    
    if not final_structure:
        return {}

    # 2. Load Meta tối thiểu để hàm generate_depth_navigation hoạt động
    valid_keys: Set[str] = set()
    _flatten_keys(final_structure, valid_keys)
    
    # Chúng ta cần type của các node để generate_depth_navigation bỏ qua leaf/alias
    # Ở cấp Super Book, hầu hết các node là 'group' hoặc 'branch' (được coi là branch trong logic nav)
    # Ta giả định tạm thời mọi node trong super tree là branch/group để tính nav
    temp_meta = {uid: {"type": "branch"} for uid in valid_keys}

    # 3. Tính Nav
    # Cấu trúc Super Tree: {"sutta": [...], "vinaya": [...]}
    # Chúng ta wrap vào root giả để tính toán
    wrapped_structure = {"tpk": final_structure}
    nav_map = generate_depth_navigation(wrapped_structure, temp_meta)
    
    logger.info(f"   ✅ Pre-calculated nav for {len(nav_map)} nodes.")
    return nav_map

def generate_super_book_data(processed_book_ids: List[str]) -> Optional[Dict[str, Any]]:
    if not RAW_SUPER_TREE_FILE.exists():
        logger.error(f"❌ Super tree not found at {RAW_SUPER_TREE_FILE}")
        return None

    logger.info("🌟 Generating Super Book Structure...")

    raw_tree = _load_json(RAW_SUPER_TREE_FILE)
    if not raw_tree: return None

    allowed_set = set(processed_book_ids)
    final_structure = _prune_tree(raw_tree, allowed_set)
    
    if not final_structure:
        logger.warning("⚠️ Super Tree is empty after pruning (No matching books found).")
        return None

    valid_keys: Set[str] = set()
    _flatten_keys(final_structure, valid_keys)
    
    final_meta = _load_super_metadata(valid_keys)

    # 1. Identify Direct Children and change type to 'branch'
    top_level_keys = []
    if isinstance(final_structure, list):
         for item in final_structure:
             if isinstance(item, str): top_level_keys.append(item)
             elif isinstance(item, dict): top_level_keys.extend(item.keys())
    elif isinstance(final_structure, dict):
        top_level_keys.extend(final_structure.keys())
    
    for key in top_level_keys:
        if key in final_meta:
            final_meta[key]['type'] = 'branch'
            
    # 2. Create Tipitaka Meta
    tipitaka_title = "The Three Baskets of the Buddhist Canon"
    final_meta["tpk"] = {
        "uid": "tpk",
        "type": "root",
        "acronym": "Tipitaka",
        "translated_title": tipitaka_title,
        "original_title": "Tipiṭaka",
        "blurb": "This is a large collection of teachings attributed to the Buddha or his earliest disciples."
    }
    
    # 3. Wrap Structure
    new_structure = {
        "tpk": final_structure
    }
    
    # 4. Calculate Navigation (Staging Phase)
    logger.info("   🧭 Calculating Super Navigation...")
    tpk_nav_map = generate_depth_navigation(new_structure, final_meta)
    
    # Inject Nav vào Meta
    for uid, nav_entry in tpk_nav_map.items():
        if uid in final_meta:
            final_meta[uid]["nav"] = nav_entry

    return {
        "id": "tpk",
        "title": tipitaka_title,
        "structure": new_structure,
        "meta": final_meta,
        "content": {} 
    }