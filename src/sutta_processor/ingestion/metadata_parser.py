# Path: src/sutta_processor/ingestion/metadata_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..shared.app_config import RAW_API_JSON_DIR, CONFIG_AUTHOR_PRIORITY, RAW_BILARA_DIR
from ..shared.domain_types import SuttaMeta

logger = logging.getLogger("SuttaProcessor.Ingestion.Meta")

def _load_child_range() -> Dict[str, str]:
    child_range_file = RAW_BILARA_DIR / "child_range.json"
    if child_range_file.exists():
        try:
            with open(child_range_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"❌ Error loading child_range.json: {e}")
    return {}

def _find_best_author(translations: List[Dict[str, Any]]) -> Optional[str]:
    if not translations: return None
    valid_trans = {
        t.get("author_uid"): t 
        for t in translations 
        if t.get("lang") == "en" and t.get("segmented") is True
    }
    for author in CONFIG_AUTHOR_PRIORITY:
        if author in valid_trans: return author
    return None

def load_names_map() -> Dict[str, SuttaMeta]:
    if not RAW_API_JSON_DIR.exists():
        logger.warning(f"⚠️ API Data directory not found: {RAW_API_JSON_DIR}")
        return {}

    logger.info("📚 Parsing metadata & resolving authors...")
    child_range_map = _load_child_range()
    meta_map: Dict[str, SuttaMeta] = {}
    json_files = sorted(list(RAW_API_JSON_DIR.rglob("*.json")))

    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            iterable = raw_data if isinstance(raw_data, list) else [raw_data]

            for item in iterable:
                uid = item.get("uid")
                if not uid: continue
                
                translations = item.get("translations", [])
                best_author = _find_best_author(translations)
                
                raw_scroll_target = item.get("scroll_target")
                parent_uid = item.get("parent_uid")
                final_scroll_target = raw_scroll_target
                if raw_scroll_target == parent_uid: final_scroll_target = None
                
                entry: SuttaMeta = {
                    "uid": uid,
                    "type": item.get("type", "leaf"),
                    "root_lang": item.get("root_lang"), # [NEW]
                    "acronym": item.get("acronym", "") or "", # [FIX] Default empty string
                    "translated_title": (item.get("translated_title") or "").strip(),
                    "original_title": (item.get("original_title") or "").strip(),
                    "blurb": item.get("blurb"),
                    "best_author_uid": best_author,
                    "author_uid": None, 
                    "extract_id": final_scroll_target,
                    "child_range": child_range_map.get(uid)
                }
                meta_map[uid] = entry

        except Exception as e:
            logger.error(f"❌ Error reading {file_path.name}: {e}")

    logger.info(f"   -> Loaded metadata for {len(meta_map)} items.")
    return meta_map