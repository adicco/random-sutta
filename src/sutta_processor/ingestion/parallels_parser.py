# Path: src/sutta_processor/ingestion/parallels_parser.py
import json
import logging
from itertools import combinations
from typing import List, Tuple
from pathlib import Path

logger = logging.getLogger("SuttaProcessor.ParallelsParser")

__all__ = ["parse_parallels"]

def _parse_sutta_id(full_id: str) -> str:
    """Loại bỏ tiền tố `~` và phần phân đoạn sau `#`."""
    cleaned_id = full_id.lstrip("~")
    return cleaned_id.split("#")[0]

def parse_parallels(file_path: Path) -> List[Tuple[str, str, str]]:
    """
    Đọc file parallels.json và bung thành các cặp (src_uid, target_uid, relation_type).
    Lưu ý: Luôn trả về 2 chiều (A -> B và B -> A).
    """
    if not file_path.exists():
        logger.warning(f"⚠️ Parallels file not found at {file_path}")
        return []

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    results = set() # Dùng set để tránh duplicate
    
    for group in data:
        if not group:
            continue
            
        relation_type = list(group.keys())[0]
        id_list = group[relation_type]

        full_list = [i for i in id_list if not i.startswith("~")]
        resembling_list = [i for i in id_list if i.startswith("~")]

        if relation_type == "parallels":
            # Các phần tử trong full_list là 'parallels' với nhau
            for source, target in combinations(full_list, 2):
                base_s = _parse_sutta_id(source)
                base_t = _parse_sutta_id(target)
                if base_s != base_t:
                    results.add((base_s, base_t, "parallels"))
                    results.add((base_t, base_s, "parallels"))
            
            # full_list liên kết với resembling_list là 'resembles'
            if full_list and resembling_list:
                for source in full_list:
                    base_s = _parse_sutta_id(source)
                    for target in resembling_list:
                        base_t = _parse_sutta_id(target)
                        if base_s != base_t:
                            results.add((base_s, base_t, "resembles"))
                            results.add((base_t, base_s, "resembles"))
                            
        elif relation_type in ["mentions", "retells"]:
            # Giữ nguyên loại relation_type
            for source, target in combinations(full_list, 2):
                base_s = _parse_sutta_id(source)
                base_t = _parse_sutta_id(target)
                if base_s != base_t:
                    results.add((base_s, base_t, relation_type))
                    results.add((base_t, base_s, relation_type))
            
            if full_list and resembling_list:
                for source in full_list:
                    base_s = _parse_sutta_id(source)
                    for target in resembling_list:
                        base_t = _parse_sutta_id(target)
                        if base_s != base_t:
                            results.add((base_s, base_t, relation_type))
                            results.add((base_t, base_s, relation_type))

    parsed_list = list(results)
    logger.info(f"   🔍 Parsed {len(parsed_list)} parallel links from {file_path.name}")
    return parsed_list
