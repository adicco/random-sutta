# Path: src/release_system/logic/artifact_packer.py
import logging
import shutil
from pathlib import Path

from ..release_config import WEB_DIR, RELEASE_DIR, APP_NAME

logger = logging.getLogger("Release.ArtifactPacker")

def create_release_artifact(version_tag: str) -> bool:
    """
    Đóng gói thư mục web/ thành file ZIP để upload lên GitHub Release.
    """
    logger.info("📦 Creating release artifact...")
    
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True, exist_ok=True)

    zip_filename = f"{APP_NAME}-{version_tag}"
    full_zip_path = RELEASE_DIR / f"{zip_filename}.zip"

    try:
        # Sử dụng shutil.make_archive để tạo file zip
        # base_name: tên file (không có đuôi .zip)
        # format: 'zip'
        # root_dir: thư mục gốc để nén (web/)
        shutil.make_archive(
            str(RELEASE_DIR / zip_filename),
            'zip',
            root_dir=WEB_DIR
        )
        
        logger.info(f"   ✅ Artifact created: {full_zip_path.name}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to create artifact: {e}")
        return False
