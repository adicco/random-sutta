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
        "sc_bilara_data/html/pli/ms": "html/pli/ms",
        "sc_bilara_data/html/pli/vri/vinaya": "html/pli/ms/vinaya",
        "sc_bilara_data/comment/en": "comment/en",
        "sc_bilara_data/translation/en/brahmali": "translation/en/brahmali",
        "sc_bilara_data/translation/en/kelly": "translation/en/kelly",
        "sc_bilara_data/translation/en/sujato/sutta": "translation/en/sujato/sutta",
        "structure/tree": "tree",
        "structure/child_range.json": "child_range.json",
    }
    IGNORE_PATTERNS: Dict[str, List[str]] = {
        "root": ["xplayground"], 
    }

class ApiConfig:
    DATA_JSON_DIR: Path = FetcherConfig.DATA_DIR / "json"
    API_TEMPLATE: str = "https://suttacentral.net/api/suttaplex/{}"
    DISCOVERY_RULES: List[DiscoveryRule] = [
        {"path": "sutta", "category": "sutta", "exclude": {"kn"}},
        {"path": "sutta/kn", "category": "sutta/kn", "exclude": set()},
        {"path": "vinaya", "category": "vinaya", "exclude": set()},
        {"path": "abhidhamma", "category": "abhidhamma", "exclude": set()}
    ]
    EXTRA_UIDS: Dict[str, str] = {
        "pli-tv-bi-pm": "vinaya",
        "pli-tv-bu-pm": "vinaya"
    }
    SUPER_TARGET_CATS: List[str] = ["sutta", "vinaya", "abhidhamma"]
    LARGE_BOOKS: Set[str] = {"dn", "mn", "sn", "an", "vinaya"}
    SYSTEM_IGNORE: Set[str] = {'xplayground', '__pycache__', '.git', '.DS_Store'}
    PRIORITY_ORDER: List[Tuple[str, str]] = [
        ("sutta", "super"), ("dn", "sutta"), ("mn", "sutta"), 
        ("sn", "sutta"), ("an", "sutta"), ("dhp", "sutta/kn"),
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