# Path: src/release_system/logic/release_versioning.py
import logging
import json
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("Release.Versioning")

def generate_version_tag() -> str:
    """
    Tạo version tag tự động cho GitHub Release.
    Format: v2025.12.05-18.25.15
    """
    now = datetime.now()
    return now.strftime("v%Y.%m.%d-%H.%M.%S")

def get_clean_version() -> str:
    """
    Tạo số version rút gọn (không có chữ v) để dùng cho package.json.
    Format: 2025.12.05 (AltStore/iOS tương thích tốt nhất với 3 thành phần)
    """
    return datetime.now().strftime("%Y.%m.%d")

def update_package_json(project_root: Path, version: str) -> bool:
    """
    Ghi số version mới vào package.json.
    """
    pkg_path = project_root / "package.json"
    if not pkg_path.exists():
        return False
        
    try:
        with open(pkg_path, 'r') as f:
            data = json.load(f)
            
        old_version = data.get("version")
        data["version"] = version
        
        with open(pkg_path, 'w') as f:
            json.dump(data, f, indent=2)
            
        logger.info(f"✅ Updated package.json: {old_version} -> {version}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update package.json: {e}")
        return False