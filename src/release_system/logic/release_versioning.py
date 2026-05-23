# Path: src/release_system/logic/release_versioning.py
import logging
import json
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("Release.Versioning")

def generate_version_tag() -> str:
    """
    Tạo version tag thống nhất cho GitHub Release.
    Format: v2026.0523.0624
    """
    now = datetime.now()
    return f"v{now.strftime('%Y.%m%d.%H%M')}"

def get_clean_version() -> str:
    """
    Tạo số version chuẩn (3 thành phần: Year.MMDD.HHMM)
    Ví dụ: 2026.0523.0624
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
    Cập nhật versionName trong file build.gradle của Android.
    """
    gradle_path = project_root / "android/app/build.gradle"
    if not gradle_path.exists():
        logger.warning(f"⚠️ Không tìm thấy file build.gradle của Android.")
        return False

    try:
        import re
        with open(gradle_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update versionName "1.0"
        new_content = re.sub(
            r'versionName "[^"]+"',
            f'versionName "{version}"',
            content
        )
        
        # Đồng thời tăng versionCode (dùng timestamp rút gọn để đảm bảo luôn tăng)
        version_code = int(datetime.now().strftime("%y%m%d%H%M"))
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