# Path: src/sutta_processor/logic/structure/structure_expansion.py
from typing import Dict, Any, List, Tuple

from ...shared.domain_types import SuttaMeta
from ..range_expander import generate_subleaf_shortcuts, generate_vinaya_variants
from .meta_service import ensure_meta_entry

def expand_structure_with_subleaves(
    node: Any, 
    raw_content_map: Dict[str, Any], 
    meta_map: Dict[str, SuttaMeta], 
    target_meta_dict: Dict[str, Any],
    generated_acc: List[Tuple[str, str, str, str]] # [NEW] Accumulator
) -> Any:
    """
    Duyệt cây, nếu gặp Node có Subleaf (range) thì bung ra và tạo meta cho con/alias.
    Đồng thời ghi nhận các item được sinh ra vào generated_acc.
    """
    if isinstance(node, str):
        uid = node
        
        if uid in raw_content_map:
            payload = raw_content_map[uid]
            parent_meta = meta_map.get(uid, {})
            parent_acronym = parent_meta.get("acronym", "")
            
            expanded_ids, generated_meta = generate_subleaf_shortcuts(
                root_uid=uid,
                content=payload.get("data", {}),
                parent_acronym=parent_acronym
            )
            
            for sc_id, sc_data in generated_meta.items():
                if sc_id not in target_meta_dict:
                    
                    # [NEW] Thu thập thông tin báo cáo
                    m_type = sc_data.get("type", "unknown")
                    # Target/Parent logic
                    target_ref = sc_data.get("target_uid") or sc_data.get("parent_uid") or ""
                    # Hash/Extract logic
                    extra_ref = sc_data.get("hash_id") or sc_data.get("extract_id") or ""
                    
                    if generated_acc is not None:
                        generated_acc.append((sc_id, m_type, target_ref, extra_ref))

                    # --- Logic tạo Meta cũ ---
                    if sc_data["type"] == "alias":
                        target = sc_data.get("target_uid") or sc_data.get("extract_id") or sc_data.get("parent_uid")
                        entry = { 
                            "type": "alias", 
                            "target_uid": target, 
                        }
                        if sc_data.get("hash_id"):
                            entry["hash_id"] = sc_data.get("hash_id")
                            
                        target_meta_dict[sc_id] = entry
                    
                    else:
                        api_info = meta_map.get(sc_id, {})
                        entry = {
                            "type": sc_data["type"],
                            "parent_uid": sc_data["parent_uid"]
                        }
                        if sc_data.get("acronym"):
                             entry["acronym"] = sc_data["acronym"]
                        if "extract_id" in sc_data:
                            entry["extract_id"] = sc_data["extract_id"]
                        
                        if sc_data.get("translated_title"):
                            entry["translated_title"] = sc_data["translated_title"]
                        elif api_info.get("translated_title"):
                            entry["translated_title"] = api_info["translated_title"]
                            
                        if sc_data.get("original_title"):
                            entry["original_title"] = sc_data["original_title"]
                        elif api_info.get("original_title"):
                            entry["original_title"] = api_info["original_title"]
                    
                        target_meta_dict[sc_id] = entry
            
            if len(expanded_ids) > 1:
                return {uid: expanded_ids}
            else:
                return uid
            
        return uid

    elif isinstance(node, list):
        new_list = []
        for child in node:
            # [UPDATED] Pass generated_acc recursively
            res = expand_structure_with_subleaves(child, raw_content_map, meta_map, target_meta_dict, generated_acc)
            if isinstance(res, list):
                 new_list.extend(res)
            else:
                 new_list.append(res)
        return new_list

    elif isinstance(node, dict):
        new_dict = {}
        for key, val in node.items():
            # [UPDATED] Pass generated_acc recursively
            new_dict[key] = expand_structure_with_subleaves(val, raw_content_map, meta_map, target_meta_dict, generated_acc)
            
            # Node cha (Key) là Branch -> Tạo meta mặc định
            ensure_meta_entry(key, "branch", meta_map, target_meta_dict)
            
            # Sinh Alias cho Branch (VD: pli-tv-kd -> kd)
            variants = generate_vinaya_variants(key)
            for var_uid in variants:
                if var_uid not in target_meta_dict:
                    
                    # [NEW] Ghi nhận Branch Alias
                    if generated_acc is not None:
                        generated_acc.append((var_uid, "alias", key, ""))

                    target_meta_dict[var_uid] = {
                        "type": "alias",
                        "target_uid": key
                    }

        return new_dict
    
    return node