# Path: src/sutta_processor/logic/content_merger.py
import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, FrozenSet, List

logger = logging.getLogger("SuttaProcessor.Logic.Merger")

# [UPDATED] Biến Global cho Worker
_WORKER_VALID_UIDS: FrozenSet[str] = frozenset()
_WORKER_FIX_MAP: Dict[Tuple[str, str, str], Any] = {}

# [UPDATED] Nhận thêm fix_map
def init_worker(valid_uids: FrozenSet[str], fix_map: Dict[Tuple[str, str, str], Any]) -> None:
    global _WORKER_VALID_UIDS, _WORKER_FIX_MAP
    _WORKER_VALID_UIDS = valid_uids
    _WORKER_FIX_MAP = fix_map

def load_json(path: Path) -> Dict[str, str]:
    if not path or not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def natural_keys(text: str):
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def _get_base_uid(uid: str) -> str:
    base = uid.split('#')[0]
    base = base.split(':')[0]
    return base.lower()

# [NEW] Hàm chuẩn hóa ký tự Pali
def _normalize_pali(text: str) -> str:
    """
    Chuẩn hóa các ký tự niggahīta cũ sang chuẩn mới.
    ṁ -> ṃ
    Ṁ -> Ṃ
    """
    if not text:
        return text
    return text.replace("ṁ", "ṃ").replace("Ṁ", "Ṃ")

# Type alias cho báo cáo
MissingItem = Tuple[str, str, str, str, str, str, str]

def _sanitize_links(text: str, current_sutta_id: str, segment_id: str, missing_acc: List[MissingItem]) -> str:
    if not text or "suttacentral.net" not in text:
        return text

    pattern = r"(<a\b[^>]*href=['\"])(https?://suttacentral\.net/([a-zA-Z0-9\.-]+)([^'\"\s]*))(['\"][^>]*>)(.*?)(</a>)"
    
    def repl(match):
        prefix = match.group(1)
        full_url = match.group(2) # Key: mentioned
        uid_raw = match.group(3)
        url_tail = match.group(4)
        suffix = match.group(5)
        anchor_text = match.group(6)
        closing = match.group(7)
        
        # --- 1. Logic Check Fix (Ưu tiên cao nhất) ---
        fix_key = (current_sutta_id, segment_id, full_url)
        if fix_key in _WORKER_FIX_MAP:
            fix_data = _WORKER_FIX_MAP[fix_key]
            fixed_uid = fix_data["target_uid"]
            
            # Chỉ áp dụng fix nếu UID đích có trong database của chúng ta
            if fixed_uid in _WORKER_VALID_UIDS:
                fixed_hash = fix_data["hash_id"]
                new_anchor = fix_data["anchor_text"] or anchor_text # Dùng text mới nếu có, ko thì giữ cũ
                
                new_href = f"index.html?q={fixed_uid}"
                if fixed_hash:
                    new_href += f"#{fixed_hash}"
                
                # Return fixed tag
                return f"{prefix}{new_href}{suffix}{new_anchor}{closing}"
        
        # --- 2. Logic Normal ---
        target_uid = _get_base_uid(uid_raw)
        hash_id = ""
        hash_match = re.search(r"#([a-zA-Z0-9\.\:-]+)", url_tail)
        if hash_match:
            hash_id = hash_match.group(1)

        if target_uid in _WORKER_VALID_UIDS:
            new_href = f"index.html?q={target_uid}"
            if hash_id:
                new_href += f"#{hash_id}"
            return f"{prefix}{new_href}{suffix}{anchor_text}{closing}"
        
        # --- 3. Logic Report Missing ---
        if re.match(r"^[a-z]", target_uid, re.I) and any(c.isdigit() for c in target_uid):
             logger.warning(f"   ⚠️  [{current_sutta_id}] Seg '{segment_id}': Missing '{target_uid}'")
             
             source_link = f"https://suttacentral.net/{current_sutta_id}/en/sujato/{segment_id}"
             missing_acc.append((
                 current_sutta_id, 
                 segment_id, 
                 source_link, 
                 full_url, 
                 anchor_text, 
                 target_uid, 
                 hash_id
             ))
        
        return match.group(0) # Keep external

    return re.sub(pattern, repl, text, flags=re.IGNORECASE)

# [NEW] Helper to extract metadata from Bilara paths
def extract_bilara_meta(path: Optional[Path], default_type: str) -> Tuple[str, str, str]:
    if not path or not path.exists():
        return default_type, "unknown", "unknown"
    
    parts = path.parts
    try:
        # Expected structure: .../bilara/{type}/{lang}/{author}/...
        if "bilara" in parts:
            idx = parts.index("bilara")
            c_type = parts[idx+1]
            lang = parts[idx+2]
            author = parts[idx+3]
            return c_type, lang, author
    except (ValueError, IndexError):
        pass

    # Fallback to filename parsing: {uid}_{type}-{lang}-{author}.json
    name = path.stem
    if "_" in name:
        meta_part = name.split("_")[1]
        if meta_part == "html":
            return "html", "pli", "ms"
        if "-" in meta_part:
            p = meta_part.split("-")
            if len(p) >= 3:
                return p[0], p[1], p[2]
    
    return default_type, "pli", "ms"

def process_worker(args: Tuple[str, Path, Optional[Path], Optional[Path], Optional[Path], Optional[Path], Optional[Path], Optional[str]]) -> Tuple[str, str, Optional[Dict[str, Any]], List[MissingItem]]:
    sutta_id, root_path, trans_path, html_path, comment_path, variant_path, reference_path, author_uid = args
    missing_refs: List[MissingItem] = []
    
    try:
        if not html_path:
            return "skipped", sutta_id, None, []

        # Extract metadata from paths
        meta_root = extract_bilara_meta(root_path, "root")
        meta_trans = extract_bilara_meta(trans_path, "translation")
        meta_html = extract_bilara_meta(html_path, "html")
        meta_comm = extract_bilara_meta(comment_path, "comment")
        meta_variant = extract_bilara_meta(variant_path, "variant")
        meta_ref = extract_bilara_meta(reference_path, "reference")

        data_root = load_json(root_path)
        data_trans = load_json(trans_path)
        data_html = load_json(html_path)
        data_comment = load_json(comment_path)
        data_variant = load_json(variant_path)
        data_reference = load_json(reference_path)

        all_keys = set(data_root.keys()) | set(data_html.keys())
        if data_trans:
            all_keys |= set(data_trans.keys())
            
        sorted_keys = sorted(list(all_keys), key=natural_keys)

        segments_dict = {} 
        has_content = False
        
        for key in sorted_keys:
            # Each key will store a list of content objects (Vertical structure)
            content_list = []

            # 1. Root (Pali)
            pali = data_root.get(key)
            if pali:
                content_list.append({
                    "type": meta_root[0],
                    "lang": meta_root[1],
                    "author": meta_root[2],
                    "content": _normalize_pali(pali)
                })

            # 2. Translation
            eng = data_trans.get(key)
            if eng:
                content_list.append({
                    "type": meta_trans[0],
                    "lang": meta_trans[1],
                    "author": meta_trans[2],
                    "content": eng
                })

            # 3. HTML Template
            html = data_html.get(key)
            if html:
                content_list.append({
                    "type": meta_html[0],
                    "lang": meta_html[1],
                    "author": meta_html[2],
                    "content": html
                })

            # 4. Comments
            comm = data_comment.get(key)
            if comm:
                content_list.append({
                    "type": meta_comm[0],
                    "lang": meta_comm[1],
                    "author": meta_comm[2],
                    "content": _sanitize_links(comm, sutta_id, key, missing_refs)
                })

            # 5. Variants
            variant = data_variant.get(key)
            if variant:
                content_list.append({
                    "type": meta_variant[0],
                    "lang": meta_variant[1],
                    "author": meta_variant[2],
                    "content": variant
                })

            # 6. References
            ref = data_reference.get(key)
            if ref:
                content_list.append({
                    "type": meta_ref[0],
                    "lang": meta_ref[1],
                    "author": meta_ref[2],
                    "content": ref
                })

            if content_list:
                segments_dict[key] = content_list
                has_content = True

        if not has_content:
             return "skipped", sutta_id, None, []

        final_data = {
            "author_uid": author_uid,
            "data": segments_dict 
        }

        return "success", sutta_id, final_data, missing_refs

    except Exception as e:
        logger.error(f"Error processing {sutta_id}: {e}")
        return "error", sutta_id, None, []