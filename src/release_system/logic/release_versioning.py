# Path: src/release_system/logic/release_versioning.py
import logging
import json
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("Release.Versioning")

def generate_version_tag() -> str:
    """
    Tạo version tag thống nhất cho GitHub Release.
    Format: v2026.143.405 (v[Year].[DayOfYear].[MinuteOfDay])
    """
    now = datetime.now()
    year = now.year
    day_of_year = now.timetuple().tm_yday
    minute_of_day = now.hour * 60 + now.minute
    return f"v{year}.{day_of_year}.{minute_of_day}"

def get_clean_version() -> str:
    """
    Tạo version theo chuẩn SemVer Universal Hybrid.
    Format: [Year].[DayOfYear].[MinuteOfDay]
    Ví dụ: Ngày 23/5/2026 lúc 06:45 sáng
    - Year: 2026
    - DayOfYear: 143 (ngày thứ 143 trong năm)
    - MinuteOfDay: 405 (6*60 + 45)
    => 2026.143.405
    
    Ưu điểm: 
    - Tuyệt đối tuân thủ SemVer (không leading zeros).
    - Luôn tăng tiến theo thời gian.
    - Đồng nhất cho Web, iOS, Android, macOS.
    """
    now = datetime.now()
    year = now.year
    day_of_year = now.timetuple().tm_yday
    minute_of_day = now.hour * 60 + now.minute
    
    return f"{year}.{day_of_year}.{minute_of_day}"

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
    """
    pbxproj_path = project_root / "ios/App/App.xcodeproj/project.pbxproj"
    if not pbxproj_path.exists():
        logger.warning(f"⚠️ Không tìm thấy file Xcode project.")
        return False

    try:
        import re
        with open(pbxproj_path, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = re.sub(
            r'MARKETING_VERSION = [^;]+;',
            f'MARKETING_VERSION = {version};',
            content
        )

        with open(pbxproj_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        logger.info(f"✅ Updated iOS version -> {version}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update iOS version: {e}")
        return False

def update_android_version(project_root: Path, version: str) -> bool:
    """
    Cập nhật versionName và versionCode trong build.gradle.
    versionCode = số phút trôi qua kể từ 01/01/2024.
    """
    gradle_path = project_root / "android/app/build.gradle"
    if not gradle_path.exists():
        logger.warning(f"⚠️ Không tìm thấy file build.gradle của Android.")
        return False

    try:
        import re
        with open(gradle_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update versionName
        new_content = re.sub(
            r'versionName "[^"]+"',
            f'versionName "{version}"',
            content
        )
        
        # versionCode Universal (1 Billion Base + Epoch Minutes since 2024)
        # Việc cộng 1 tỷ đảm bảo versionCode luôn cao hơn các bản build lỗi trước đó
        # nhưng vẫn < 2.1 tỷ (Giới hạn của Android).
        epoch_base = datetime(2024, 1, 1)
        now = datetime.now()
        version_code = 1000000000 + int((now - epoch_base).total_seconds() / 60)
        
        new_content = re.sub(
            r'versionCode \d+',
            f'versionCode {version_code}',
            new_content
        )

        with open(gradle_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        logger.info(f"✅ Updated Android version -> {version} (code: {version_code})")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update Android version: {e}")
        return False

def update_tauri_version(project_root: Path, version: str) -> bool:
    """
    Cập nhật version trong tauri.conf.json và Cargo.toml cho macOS/Desktop.
    """
    conf_path = project_root / "src-tauri/tauri.conf.json"
    cargo_path = project_root / "src-tauri/Cargo.toml"
    
    success = True
    
    # 1. Update tauri.conf.json
    if conf_path.exists():
        try:
            with open(conf_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            data["version"] = version
            with open(conf_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info(f"✅ Updated tauri.conf.json version -> {version}")
        except Exception as e:
            logger.error(f"❌ Failed to update tauri.conf.json: {e}")
            success = False
            
    # 2. Update Cargo.toml
    if cargo_path.exists():
        try:
            import re
            with open(cargo_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # version = "0.1.0" -> ở đầu file trong [package]
            new_content = re.sub(
                r'^version = "[^"]+"',
                f'version = "{version}"',
                content,
                flags=re.MULTILINE
            )
            
            with open(cargo_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            logger.info(f"✅ Updated Cargo.toml version -> {version}")
        except Exception as e:
            logger.error(f"❌ Failed to update Cargo.toml: {e}")
            success = False
            
    return success
