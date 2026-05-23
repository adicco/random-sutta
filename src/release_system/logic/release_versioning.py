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
    Tạo số version chuẩn iOS (3 thành phần: Year.MMDD.HHMM)
    Ví dụ: 2026.0523.1430
    AltStore và iOS yêu cầu CFBundleShortVersionString phải là các số cách nhau bởi dấu chấm.
    """
    now = datetime.now()
    year = now.strftime("%Y")
    mmdd = now.strftime("%m%d")
    hhmm = now.strftime("%H%M")
    return f"{year}.{mmdd}.{hhmm}"

def update_package_json(project_root: Path, version: str) -> bool:
    """
    Ghi số version mới vào package.json.
    """
    pkg_path = project_root / "package.json"
    if not pkg_path.exists():
        return False
        
    try:
        with open(pkg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        old_version = data.get("version")
        data["version"] = version
        
        with open(pkg_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"✅ Updated package.json: {old_version} -> {version}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update package.json: {e}")
        return False

def update_xcode_version(project_root: Path, version: str) -> bool:
    """
    Cập nhật MARKETING_VERSION trong file pbxproj của Xcode.
    Điều này cực kỳ quan trọng để AltStore không báo lỗi mismatch.
    """
    pbxproj_path = project_root / "ios/App/App.xcodeproj/project.pbxproj"
    if not pbxproj_path.exists():
        logger.warning(f"⚠️ Không tìm thấy file Xcode project tại: {pbxproj_path}")
        return False

    try:
        import re
        with open(pbxproj_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Regex để tìm và thay thế MARKETING_VERSION
        # Pattern: MARKETING_VERSION = 1.0;
        new_content = re.sub(
            r'MARKETING_VERSION = [^;]+;',
            f'MARKETING_VERSION = {version};',
            content
        )

        with open(pbxproj_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        logger.info(f"✅ Updated Xcode MARKETING_VERSION -> {version}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update Xcode version: {e}")
        return False