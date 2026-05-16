# Path: src/sutta_processor/logic/structure/meta_service.py
from typing import Dict, Any
from ...shared.domain_types import SuttaMeta

def ensure_meta_entry(
    uid: str, 
    type_default: str, 
    meta_map: Dict[str, SuttaMeta], 
    target_dict: Dict[str, Any]
) -> None:
    """Đảm bảo một UID có meta trong target_dict."""
    if uid in target_dict:
        return

    info = meta_map.get(uid, {}) # type: ignore
    
    entry = {
        "type": info.get("type", type_default),
        "root_lang": info.get("root_lang"), # [NEW]
        "translated_title": info.get("translated_title", ""),
        "original_title": info.get("original_title", ""),
        "blurb": info.get("blurb"),
        "author_uid": None
    }
    
    # Chỉ thêm field nếu có dữ liệu (làm sạch staging)
    if info.get("acronym"):
        entry["acronym"] = info["acronym"]
    
    eid = info.get("extract_id")
    if eid:
        entry["extract_id"] = eid

    crange = info.get("child_range")
    if crange:
        entry["child_range"] = crange

    target_dict[uid] = entry