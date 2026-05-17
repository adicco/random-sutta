# Path: src/sutta_processor/ingestion/parallels_parser.py
import json
import logging
from collections import defaultdict
from itertools import combinations
from typing import Dict, List
from pathlib import Path

logger = logging.getLogger("SuttaProcessor.ParallelsParser")

__all__ = ["parse_parallels"]

def _parse_sutta_id(full_id: str) -> str:
    """Loại bỏ tiền tố `~` và phần phân đoạn sau `#`."""
    cleaned_id = full_id.lstrip("~")
    return cleaned_id.split("#")[0]

def parse_parallels(file_path: Path) -> Dict[str, Dict[str, List[str]]]:
    """
    Đọc file parallels.json và gom nhóm thành cấu trúc:
    { "mn1": { "parallels": ["ma10", ...], "resembles": ["t56", ...] } }
    """
    if not file_path.exists():
        logger.warning(f"⚠️ Parallels file not found at {file_path}")
        return {}

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Dùng set để tránh duplicate trong quá trình build
    sutta_map = defaultdict(lambda: defaultdict(set))
    
    for group in data:
        if not group:
            continue
            
        relation_type = list(group.keys())[0]
        id_list = group[relation_type]

        full_list = [i for i in id_list if not i.startswith("~")]
        resembling_list = [i for i in id_list if i.startswith("~")]

        if relation_type == "parallels":
            for source, target in combinations(full_list, 2):
                base_s = _parse_sutta_id(source)
                base_t = _parse_sutta_id(target)
                if base_s != base_t:
                    sutta_map[base_s]["parallels"].add(base_t)
                    sutta_map[base_t]["parallels"].add(base_s)
            
            if full_list and resembling_list:
                for source in full_list:
                    base_s = _parse_sutta_id(source)
                    for target in resembling_list:
                        base_t = _parse_sutta_id(target)
                        if base_s != base_t:
                            sutta_map[base_s]["resembles"].add(base_t)
                            sutta_map[base_t]["resembles"].add(base_s)
                            
        elif relation_type in ["mentions", "retells"]:
            for source, target in combinations(full_list, 2):
                base_s = _parse_sutta_id(source)
                base_t = _parse_sutta_id(target)
                if base_s != base_t:
                    sutta_map[base_s][relation_type].add(base_t)
                    sutta_map[base_t][relation_type].add(base_s)
            
            if full_list and resembling_list:
                for source in full_list:
                    base_s = _parse_sutta_id(source)
                    for target in resembling_list:
                        base_t = _parse_sutta_id(target)
                        if base_s != base_t:
                            sutta_map[base_s][relation_type].add(base_t)
                            sutta_map[base_t][relation_type].add(base_s)

    # Chuyển đổi set thành list để có thể dump ra JSON
    final_dict = {}
    for uid, rels in sutta_map.items():
        final_dict[uid] = {rel_type: sorted(list(targets)) for rel_type, targets in rels.items()}

    logger.info(f"   🔍 Parsed parallels for {len(final_dict)} unique suttas from {file_path.name}")
    return final_dict
