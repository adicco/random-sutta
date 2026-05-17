# Path: src/sutta_processor/ingestion/legacy_converter/config.py
from pathlib import Path
from typing import Dict, Set
import re

class ConverterConfig:
    PROJECT_ROOT: Path = Path(__file__).parents[4]
    HTML_TEXT_DIR: Path = PROJECT_ROOT / "data" / "html_text"
    BILARA_MORE_DIR: Path = PROJECT_ROOT / "data" / "bilara_more"
    BILARA_ROOT_DIR: Path = PROJECT_ROOT / "data" / "bilara" / "root"
    
    # Mapping uid prefix to Taisho text number (for reference mapping)
    TAISHO_MAPPING: Dict[str, str] = {
        "da": "1",
        "ma": "26",
        "sa": "99",
        "ea": "125",
        "lzh-dhp": "210",
        "lzh-dg-bi-pm": "1431",
        "lzh-dg-bu-pm": "1429",
        "lzh-mg-bu-pm": "1426",
        "lzh-mi-bu-pm": "1422",
        "lzh-sarv-bu-pm": "1436",
        "lzh-mu-bu-pm": "1461",
        # Thêm các map khác nếu cần
    }

    @staticmethod
    def get_taisho_no(uid: str) -> str:
        # 1. Check if it's a direct Taisho UID (e.g., t210.31 -> 210)
        if uid.startswith('t'):
            match = re.match(r'^t(\d+)', uid)
            if match:
                return match.group(1)

        # 2. Check mapping for prefixes (e.g., sa1 -> 99)
        # Thử tìm các từ khóa dài trước
        for key in sorted(ConverterConfig.TAISHO_MAPPING.keys(), key=len, reverse=True):
            if uid.startswith(key):
                return ConverterConfig.TAISHO_MAPPING[key]
        return "0" # Fallback nếu không tìm thấy

