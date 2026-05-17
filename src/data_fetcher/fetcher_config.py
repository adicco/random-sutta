# Path: src/data_fetcher/fetcher_config.py
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple, TypedDict

# Định nghĩa kiểu dữ liệu cho Rule quét
class DiscoveryRule(TypedDict):
    path: str
    category: str
    exclude: Set[str]

class FetcherConfig:
    PROJECT_ROOT: Path = Path(__file__).parents[2]
    DATA_DIR: Path = PROJECT_ROOT / "data"
    CACHE_DIR: Path = Path(".cache/sc_bilara_data")

class BilaraConfig:
    DATA_ROOT: Path = FetcherConfig.DATA_DIR / "bilara"
    ROOT_TEXT_DIR: Path = DATA_ROOT / "root" / "pli" / "ms"
    REPO_URL: str = "https://github.com/suttacentral/sc-data.git"
    BRANCH_NAME: str = "main"
    FETCH_MAPPING: Dict[str, str] = {
        "sc_bilara_data/root/pli/ms": "root/pli/ms",
        "sc_bilara_data/root/lzh": "root/lzh",
        "sc_bilara_data/html/pli/ms": "html/pli/ms",
        "sc_bilara_data/html/pli/vri/vinaya": "html/pli/ms/vinaya",
        "sc_bilara_data/html/lzh/sct": "html/lzh/sct",
        "sc_bilara_data/comment/en": "comment/en",
        "sc_bilara_data/variant/pli/ms": "variant/pli/ms",
        "sc_bilara_data/variant/lzh/sct/sutta": "variant/lzh/sct/sutta",
        "sc_bilara_data/reference/pli/ms": "reference/pli/ms",
        "sc_bilara_data/reference/lzh": "reference/lzh",
        "sc_bilara_data/translation/en/brahmali": "translation/en/brahmali",
        "sc_bilara_data/translation/en/kelly": "translation/en/kelly",
        "sc_bilara_data/translation/en/sujato/sutta": "translation/en/sujato/sutta",
        "sc_bilara_data/translation/en/patton/sutta": "translation/en/patton/sutta",
        "structure/tree": "tree",
        "structure/child_range.json": "child_range.json",
    }
    IGNORE_PATTERNS: Dict[str, List[str]] = {
        "root": ["xplayground"], 
    }

class HtmlTextConfig:
    DATA_ROOT: Path = FetcherConfig.DATA_DIR / "html_text"
    FETCH_MAPPING: Dict[str, str] = {
        "html_text/lzh": "lzh",
        "html_text/zh": "zh",
        "html_text/vi": "vi",
    }

class ApiConfig:
    DATA_JSON_DIR: Path = FetcherConfig.DATA_DIR / "json"
    API_TEMPLATE: str = "https://suttacentral.net/api/suttaplex/{}"
    DISCOVERY_RULES: List[DiscoveryRule] = [
        {"path": "sutta", "category": "pli/sutta", "exclude": {"kn"}},
        {"path": "sutta/kn", "category": "pli/sutta/kn", "exclude": set()},
        {"path": "vinaya", "category": "pli/vinaya", "exclude": set()},
        {"path": "abhidhamma", "category": "pli/abhidhamma", "exclude": set()},
        {"path": "lzh", "category": "lzh/sutta", "exclude": set()}, # Sẽ được fetch vào lzh/sutta
    ]
    EXTRA_UIDS: Dict[str, str] = {
        # Pli Extras
        "pli-tv-bi-pm": "pli/vinaya",
        "pli-tv-bu-pm": "pli/vinaya",
        # Lzh Sutta
        "da": "lzh/sutta", "da-ot": "lzh/sutta", "ea": "lzh/sutta", 
        "ea-2": "lzh/sutta", "ea-ot": "lzh/sutta", "lzh-art": "lzh/sutta", 
        "lzh-dharani": "lzh/sutta", "lzh-dhp": "lzh/sutta", "lzh-nbs": "lzh/sutta", 
        "lzh-ssnp": "lzh/sutta", "ma": "lzh/sutta", "ma-ot": "lzh/sutta", 
        "sa": "lzh/sutta", "sa-2": "lzh/sutta", "sa-3": "lzh/sutta", "sa-ot": "lzh/sutta",
        # Lzh Vinaya
        "lzh-dg-bi-vb": "lzh/vinaya", "lzh-dg-bu-vb": "lzh/vinaya", "lzh-dg-kd": "lzh/vinaya", 
        "lzh-mg-asc": "lzh/vinaya", "lzh-mg-bi-pn": "lzh/vinaya", "lzh-mg-bi-vb": "lzh/vinaya", 
        "lzh-mg-bu-pn": "lzh/vinaya", "lzh-mg-bu-vb": "lzh/vinaya", "lzh-mi-bi-vb": "lzh/vinaya", 
        "lzh-mi-bu-vb": "lzh/vinaya", "lzh-mi-kd": "lzh/vinaya", "lzh-sarv-ba": "lzh/vinaya", 
        "lzh-sarv-bi-vb": "lzh/vinaya", "lzh-sarv-bu-vb": "lzh/vinaya", "lzh-sarv-kd": "lzh/vinaya", 
        "lzh-sarv-upp": "lzh/vinaya", "lzh-sarv-ve": "lzh/vinaya", "lzh-sarv-vi-misc": "lzh/vinaya", 
        "lzh-dg-bi-pm": "lzh/vinaya", "lzh-dg-bu-pm-2": "lzh/vinaya", "lzh-dg-bu-pm": "lzh/vinaya", 
        "lzh-dg-ve1": "lzh/vinaya", "lzh-dg-vs1": "lzh/vinaya", "lzh-ka-bu-pm": "lzh/vinaya", 
        "lzh-mg-bi-pm": "lzh/vinaya", "lzh-mg-bu-pm": "lzh/vinaya", "lzh-mi-bi-pm": "lzh/vinaya", 
        "lzh-mi-bu-pm": "lzh/vinaya", "lzh-mi-vs1": "lzh/vinaya", "lzh-mu-bi-pm": "lzh/vinaya", 
        "lzh-mu-bu-pm": "lzh/vinaya", "lzh-sarv-bi-pm": "lzh/vinaya", "lzh-sarv-bu-pm-2": "lzh/vinaya", 
        "lzh-sarv-bu-pm": "lzh/vinaya",
    }
    SUPER_TARGET_CATS: List[str] = ["sutta", "vinaya", "abhidhamma"]
    LARGE_BOOKS: Set[str] = {"dn", "mn", "sn", "an", "vinaya"}
    SYSTEM_IGNORE: Set[str] = {'xplayground', '__pycache__', '.git', '.DS_Store'}
    PRIORITY_ORDER: List[Tuple[str, str]] = [
        ("sutta", "super"), ("dn", "pli/sutta"), ("mn", "pli/sutta"), 
        ("sn", "pli/sutta"), ("an", "pli/sutta"), ("dhp", "pli/sutta/kn"),
        ("vinaya", "super"), ("abhidhamma", "super"),
    ]
    TIMEOUT_DEFAULT: int = 60
    TIMEOUT_SUPER: int = 120
    TIMEOUT_LARGE: int = 90
    @staticmethod
    def get_worker_count() -> int:
        return min(12, (os.cpu_count() or 1) * 2)

class DpdConfig:
    # --- Paths ---
    DATA_DIR: Path = FetcherConfig.DATA_DIR / "dpd"
    VERSION_FILE: Path = DATA_DIR / "version.txt"
    
    # --- GitHub Settings ---
    GITHUB_API_LATEST: str = "https://api.github.com/repos/digitalpalidictionary/dpd-db/releases/latest"
    ASSET_NAME: str = "dpd.db.tar.bz2"

class ParallelsConfig:
    URL: str = "https://raw.githubusercontent.com/suttacentral/sc-data/main/relationship/new_parallels.json"
    DEST_DIR: Path = FetcherConfig.DATA_DIR / "json" / "sc-data"
    DEST_FILE: Path = DEST_DIR / "parallels.json"