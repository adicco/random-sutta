# Path: src/sutta_processor/logic/range_expander/range_id_processor.py
from typing import List, Tuple, Set, Optional
from .range_rules import RANGE_PATTERN, VINAYA_REGEX_RULES

__all__ = ["parse_range_string", "expand_alias_ids", "expand_range_ids", "generate_vinaya_variants"]

def parse_range_string(uid: str) -> Optional[Tuple[str, int, int]]:
    """
    Phân tích chuỗi UID để tìm dải số (range).
    """
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

def expand_alias_ids(prefix: str, start: int, end: int) -> List[str]:
    """
    Sinh danh sách ID từ dải số.
    """
    return [f"{prefix}{i}" for i in range(start, end + 1)]

def expand_range_ids(uid: str) -> List[str]:
    """
    [PUBLIC] Phân tích UID dạng range (dhp383-423) và trả về danh sách các ID con.
    """
    range_info = parse_range_string(uid)
    if range_info:
        prefix, start, end = range_info
        return expand_alias_ids(prefix, start, end)
    return []

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
            break
            
    return variants
