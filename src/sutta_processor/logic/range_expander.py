# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
import unicodedata
from typing import Dict, Any, List, Tuple, Set, Optional

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

ARTICLE_ID_PATTERN = re.compile(r"<article[^>]*\sid=['\"]([^'\"]+)['\"]", re.IGNORECASE)
RANGE_PATTERN = re.compile(r"^(.*?)(\d+)[-–](\d+)$")

# Định nghĩa các quy tắc Regex cho Vinaya (Thứ tự ưu tiên: Cụ thể -> Khái quát)
VINAYA_REGEX_RULES = [
    # 1. Bhikkhuni Vibhanga (pli-tv-bi-vb-pj1 -> ipj1)
    (re.compile(r"^pli-tv-bi-vb-(.+)$"), r"i\1"),
    # 2. Bhikkhu Vibhanga (pli-tv-bu-vb-pj1 -> pj1)
    (re.compile(r"^pli-tv-bu-vb-(.+)$"), r"\1"),
    # 3. General Bhikkhuni (pli-tv-bi-pc1 -> ipc1)
    (re.compile(r"^pli-tv-bi-(.+)$"), r"i\1"),
    # 4. General Bhikkhu (pli-tv-bu-pc1 -> pc1)
    (re.compile(r"^pli-tv-bu-(.+)$"), r"\1"),
    # 5. General Vinaya (pli-tv-kd1 -> kd1)
    (re.compile(r"^pli-tv-(.+)$"), r"\1"),
]

def _parse_range_string(uid: str) -> Optional[Tuple[str, int, int]]:
    # [OPTIMIZATION] Fast fail: Nếu không có dấu gạch ngang, chắc chắn không phải range
    if "-" not in uid and "–" not in uid:
        return None
        
    match = RANGE_PATTERN.match(uid)
    if match:
        prefix = match.group(1)
        try:
            start = int(match.group(2))
            end = int(match.group(3))
            if start < end and (end - start) < 1000: 
                return prefix, start, end
        except ValueError:
            pass
    return None

def _expand_alias_ids(prefix: str, start: int, end: int) -> List[str]:
    return [f"{prefix}{i}" for i in range(start, end + 1)]

def expand_range_ids(uid: str) -> List[str]:
    """
    [PUBLIC] Phân tích UID dạng range (dhp383-423) và trả về danh sách các ID con.
    """
    range_info = _parse_range_string(uid)
    if range_info:
        prefix, start, end = range_info
        return _expand_alias_ids(prefix, start, end)
    return []

def _slugify(text: str) -> str:
    # Remove leading numbers like "1. " or "1.2 "
    text = re.sub(r'^\d+(\.\d+)*\.\s*', '', text)
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return text

def _extract_subleaf_metadata(content: Dict[str, Any], root_uid: str) -> List[Dict[str, str]]:
    """
    Trích xuất danh sách subleaf dựa vào thẻ <article> (ưu tiên) hoặc <h2>.
    Trả về list of dict: {"uid": str, "extract_id": str, "title": str}
    """
    found_items = []
    seen_uids = set()
    sorted_keys = sorted(content.keys(), key=lambda x: [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', x)])

    for seg_key in sorted_keys:
        content_items = content[seg_key]
        if not isinstance(content_items, list):
            continue
            
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
                
        # 1. Check for <article id="...">
        if html_content:
            matches = ARTICLE_ID_PATTERN.findall(html_content)
            for aid in matches:
                if aid != root_uid and aid not in seen_uids:
                    seen_uids.add(aid)
                    found_items.append({
                        "uid": aid,
                        "extract_id": aid,
                        "original_title": "",
                        "translated_title": ""
                    })
                    
        # 2. Check for <h2>
        if "<h2>" in html_content or "<h2 " in html_content:
            trans_title = re.sub(r'<[^>]+>', '', trans_text).strip()
            root_title = re.sub(r'<[^>]+>', '', root_text).strip()
            
            slug_base = root_title if root_title else trans_title
            if slug_base:
                slug = _slugify(slug_base)
                uid = f"{root_uid}-{slug}"
                if uid not in seen_uids:
                    seen_uids.add(uid)
                    found_items.append({
                        "uid": uid,
                        "extract_id": seg_key,
                        "original_title": root_title,
                        "translated_title": trans_title
                    })

    return found_items

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, replacement: str) -> str:
    if not parent_acronym: return ""
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}")
    new_acronym = range_pattern.sub(str(replacement), parent_acronym)
    return new_acronym if new_acronym != parent_acronym else ""

def generate_vinaya_variants(uid: str) -> Set[str]:
    """
    [PUBLIC] Sinh ra biến thể tên gọi (Alias) dựa trên quy tắc Vinaya.
    Chỉ lấy biến thể match đầu tiên (độ ưu tiên cao nhất).
    """
    variants = set()
    for pattern, replacement in VINAYA_REGEX_RULES:
        if pattern.match(uid):
            alias = pattern.sub(replacement, uid)
            if alias and alias != uid:
                variants.add(alias)
            
            # [OPTIMIZATION] Stop at first match (Priority Rule)
            # Đảm bảo chỉ sinh ra 1 alias tốt nhất, tránh sinh alias rác từ các rule chung chung phía sau.
            break
            
    return variants

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    
    result_meta = {}
    ordered_structure_ids = []
    
    subleaf_items = _extract_subleaf_metadata(content, root_uid)
    root_range_info = _parse_range_string(root_uid)

    # --- CASE A: SINGLE LEAF ---
    if len(subleaf_items) <= 1:
        ordered_structure_ids.append(root_uid)
        
        if root_range_info:
            prefix, start, end = root_range_info
            aliases = _expand_alias_ids(prefix, start, end)
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
            if root_range_info:
                r_prefix, r_start, r_end = root_range_info
                if sub_uid.startswith(r_prefix):
                    suffix = sub_uid[len(r_prefix):]
                    display_suffix = suffix.replace("-", "–")
                    sub_acronym = _generate_smart_acronym(parent_acronym, r_start, r_end, display_suffix)

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

            sub_range = _parse_range_string(sub_uid)
            if sub_range:
                p_prefix, p_start, p_end = sub_range
                aliases = _expand_alias_ids(p_prefix, p_start, p_end)
                
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
