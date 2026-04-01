# Path: src/sutta_processor/shared/app_config.py
from pathlib import Path

# --- BASE PATHS ---
PROJECT_ROOT = Path(__file__).parents[3]
_DATA_BASE = PROJECT_ROOT / "data"
_WEB_BASE = PROJECT_ROOT / "web"
_ASSETS_BASE = _WEB_BASE / "assets"

# --- 1. RAW INPUTS (Source of Truth) ---
RAW_BILARA_DIR = _DATA_BASE / "bilara"
RAW_BILARA_TEXT_DIR = RAW_BILARA_DIR / "root/pli/ms"
RAW_API_JSON_DIR = _DATA_BASE / "json"
RAW_SUPER_META_DIR = RAW_API_JSON_DIR / "super"
RAW_SUPER_TREE_FILE = RAW_BILARA_DIR / "tree" / "super-tree.json"

# [NEW] Fix Data
FIX_DATA_DIR = _DATA_BASE / "fix"
MISSING_LINKS_FIX_FILE = FIX_DATA_DIR / "missing_links_fixed.tsv"

# --- 2. STAGING AREA ---
STAGE_PROCESSED_DIR = _DATA_BASE / "processed"

# --- 3. DISTRIBUTION OUTPUTS ---
DIST_DB_DIR = _WEB_BASE / "public" / "assets" / "db"
DIST_JS_MODULES_DIR = _ASSETS_BASE / "modules"
LEGACY_DIST_BOOKS_DIR = _WEB_BASE / "public" / "assets" / "books"

# --- 4. DEV TOOLS ---
DEV_MIRROR_DB_DIR = _DATA_BASE / "db_mirror"

# --- 5. LOGIC CONFIGURATION ---
DB_CHUNK_SIZE_BYTES = 50 * 1024 
CONFIG_AUTHOR_PRIORITY = ["sujato", "brahmali", "kelly"]
CONFIG_PRIMARY_BOOKS = [
    "dn", "mn", "sn", "an", 
    "kp", "dhp", "ud", "iti", "snp", "thag", "thig"
]
DEBUG_PROCESS_LIMIT = 0