# Path: src/sutta_processor/logic/range_expander/range_content_extractor.py
import re
from typing import Dict, Any, List
from .range_rules import ARTICLE_ID_PATTERN

__all__ = ["extract_subleaf_metadata"]

def extract_subleaf_metadata(content: Dict[str, Any], root_uid: str) -> List[Dict[str, str]]:
    """
    Trích xuất danh sách subleaf dựa vào thẻ <article> (ưu tiên) hoặc <h2>.
    Trả về list of dict: {"uid": str, "extract_id": str, "title": str}
    
    [RULE] Nếu tìm thấy bất kỳ thẻ <article> nào (khác với root_uid), ta coi như 
    file này đã được phân mảnh theo Article và sẽ bỏ qua việc quét <h2>.
    """
    sorted_keys = sorted(content.keys(), key=lambda x: [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', x)])

    # --- PHASE 1: COLLECT ARTICLES ---
    article_items = []
    seen_uids = set()

    for seg_key in sorted_keys:
        content_items = content[seg_key]
        if not isinstance(content_items, list): continue
            
        html_content = ""
        for item in content_items:
            if item.get("type") == "html":
                html_content = item.get("content", "")
                break
        
        if html_content:
            matches = ARTICLE_ID_PATTERN.findall(html_content)
            for aid in matches:
                if aid != root_uid and aid not in seen_uids:
                    seen_uids.add(aid)
                    article_items.append({
                        "uid": aid,
                        "extract_id": aid,
                        "original_title": "",
                        "translated_title": ""
                    })

    # Nếu tìm thấy Article subleafs, trả về luôn và bỏ qua Phase 2
    if article_items:
        return article_items

    # --- PHASE 2: COLLECT H2 (Only if no articles found) ---
    h2_items = []
    h2_counter = 0
    
    intro_pali_title = ""
    intro_extract_id = ""
    has_intro_content = False
    found_first_h2 = False
    found_h1 = False
    
    for seg_key in sorted_keys:
        content_items = content[seg_key]
        if not isinstance(content_items, list): continue
            
        html_content = ""
        root_text = ""
        trans_text = ""
        
        for item in content_items:
            t = item.get("type")
            if t == "html":
                html_content = item.get("content", "")
            elif t == "root":
                root_text = item.get("content", "")
            elif t == "translation":
                trans_text = item.get("content", "")
        
        is_h2 = "<h2>" in html_content or "<h2 " in html_content
        is_h1 = "<h1>" in html_content or "<h1 " in html_content
        
        if is_h2:
            found_first_h2 = True
            h2_counter += 1
            
            # Clean titles: strip tags and leading digits
            raw_trans_title = re.sub(r'<[^>]+>', '', trans_text).strip()
            raw_root_title = re.sub(r'<[^>]+>', '', root_text).strip()
            
            # Remove prefix like "1. ", "2. ", etc.
            clean_trans_title = re.sub(r'^\d+\.\s*', '', raw_trans_title)
            clean_root_title = re.sub(r'^\d+\.\s*', '', raw_root_title)
            
            uid = f"{root_uid}.{h2_counter}"
            h2_items.append({
                "uid": uid,
                "extract_id": seg_key,
                "original_title": clean_root_title,
                "translated_title": clean_trans_title
            })
        elif is_h1:
            found_h1 = True
            continue
        elif found_h1 and not found_first_h2:
            # Check if it's NOT a header (h3, h4, etc.)
            is_any_header = re.search(r'<h[1-6]', html_content, re.IGNORECASE)
            
            cleaned_root = re.sub(r'<[^>]+>', '', root_text).strip()
            cleaned_trans = re.sub(r'<[^>]+>', '', trans_text).strip()

            if not is_any_header and (cleaned_root or cleaned_trans):
                if not has_intro_content:
                    has_intro_content = True
                    intro_extract_id = seg_key # First content segment
                
                if not intro_pali_title and cleaned_root:
                    intro_pali_title = cleaned_root
                    # Prefer segment with Pali as the starting point if possible
                    intro_extract_id = seg_key

    # Add Intro subleaf at the beginning if found
    if has_intro_content:
        intro_uid = f"{root_uid}.0"
        h2_items.insert(0, {
            "uid": intro_uid,
            "extract_id": intro_extract_id,
            "original_title": intro_pali_title,
            "translated_title": "Intro"
        })

    return h2_items
