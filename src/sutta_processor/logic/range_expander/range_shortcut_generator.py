# Path: src/sutta_processor/logic/range_expander/range_shortcut_generator.py
import re
import logging
from typing import Dict, Any, List, Tuple
from .range_id_processor import parse_range_string, expand_alias_ids, generate_vinaya_variants
from .range_content_extractor import extract_subleaf_metadata

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

__all__ = ["generate_subleaf_shortcuts"]

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, replacement: str) -> str:
    if not parent_acronym: return ""
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}")
    new_acronym = range_pattern.sub(str(replacement), parent_acronym)
    return new_acronym if new_acronym != parent_acronym else ""

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    """
    [PUBLIC] Tạo danh sách meta shortcuts cho các subleaf và alias.
    """
    result_meta = {}
    ordered_structure_ids = []
    
    subleaf_items = extract_subleaf_metadata(content, root_uid)
    root_range_info = parse_range_string(root_uid)

    # --- CASE A: SINGLE LEAF ---
    if len(subleaf_items) <= 1:
        ordered_structure_ids.append(root_uid)
        
        if root_range_info:
            prefix, start, end = root_range_info
            aliases = expand_alias_ids(prefix, start, end)
            if len(aliases) > 0:
                logger.debug(f"   ✨ Single Leaf Range Expansion: {root_uid} -> {len(aliases)} aliases")

            for alias_id in aliases:
                if alias_id == root_uid: continue
                result_meta[alias_id] = {
                    "type": "alias",
                    "target_uid": root_uid,
                    "hash_id": None
                }

    # --- CASE B: MULTI SUBLEAFS ---
    else:
        logger.debug(f"   🌿 Subleafs Detected: {root_uid} -> {len(subleaf_items)} subleafs")

        for sub_item in subleaf_items:
            sub_uid = sub_item["uid"]
            extract_id = sub_item["extract_id"]
            orig_title = sub_item.get("original_title", "")
            trans_title = sub_item.get("translated_title", "")
            
            ordered_structure_ids.append(sub_uid)
            
            sub_acronym = ""
            if root_range_info and sub_uid.startswith(root_range_info[0]):
                # Fallback for ranges (e.g., dhp1-20 -> dhp1)
                r_prefix, r_start, r_end = root_range_info
                suffix = sub_uid[len(r_prefix):]
                display_suffix = suffix.replace("-", "–")
                sub_acronym = _generate_smart_acronym(parent_acronym, r_start, r_end, display_suffix)
                
            if not sub_acronym and parent_acronym and sub_uid.startswith(root_uid + "."):
                # Handle heading-based subleafs (e.g., mn2.1, mn2.0)
                suffix = sub_uid[len(root_uid) + 1:] # Skip root_uid and dot
                sub_acronym = f"{parent_acronym}.{suffix}"

            result_meta[sub_uid] = {
                "type": "subleaf",
                "parent_uid": root_uid,
                "extract_id": extract_id,
                "acronym": sub_acronym
            }
            if orig_title:
                result_meta[sub_uid]["original_title"] = orig_title
            if trans_title:
                result_meta[sub_uid]["translated_title"] = trans_title

            sub_range = parse_range_string(sub_uid)
            if sub_range:
                p_prefix, p_start, p_end = sub_range
                aliases = expand_alias_ids(p_prefix, p_start, p_end)
                
                for alias_id in aliases:
                    if alias_id == sub_uid: continue
                    result_meta[alias_id] = {
                        "type": "alias",
                        "target_uid": root_uid,
                        "hash_id": sub_uid
                    }

    # =================================================================
    # [UNIVERSAL POST-PROCESS] SINH BIẾN THỂ VINAYA
    # =================================================================
    
    # 1. Sinh biến thể cho Root UID
    root_variants = generate_vinaya_variants(root_uid)
    for var_uid in root_variants:
        if var_uid not in result_meta:
            result_meta[var_uid] = {
                "type": "alias",
                "target_uid": root_uid,
                "hash_id": None
            }

    # 2. Sinh biến thể cho TẤT CẢ items hiện có
    current_keys = list(result_meta.keys())
    
    for item_uid in current_keys:
        item_data = result_meta[item_uid]
        variants = generate_vinaya_variants(item_uid)
        
        final_target = item_data.get("target_uid") or item_data.get("parent_uid")
        final_hash = item_data.get("hash_id") or item_data.get("extract_id")

        if item_data["type"] == "alias" and not final_hash and not final_target:
             final_target = root_uid

        for var_uid in variants:
            if var_uid not in result_meta and var_uid not in ordered_structure_ids:
                result_meta[var_uid] = {
                    "type": "alias",
                    "target_uid": final_target,
                    "hash_id": final_hash
                }

    return ordered_structure_ids, result_meta
