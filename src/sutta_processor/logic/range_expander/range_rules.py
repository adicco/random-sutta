# Path: src/sutta_processor/logic/range_expander/range_rules.py
import re

__all__ = ["ARTICLE_ID_PATTERN", "RANGE_PATTERN", "VINAYA_REGEX_RULES"]

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
