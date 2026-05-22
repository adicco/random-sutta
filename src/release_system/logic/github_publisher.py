# Path: src/release_system/logic/github_publisher.py
import logging
import subprocess
import shutil
from pathlib import Path

from ..release_config import PROJECT_ROOT, APP_NAME, RELEASE_DIR

logger = logging.getLogger("Release.GitHubPublisher")

def _check_gh_cli() -> bool:
    if not shutil.which("gh"):
        logger.error("❌ GitHub CLI ('gh') not found.")
        return False
    return True

def publish_release(version_tag: str, is_official: bool = False) -> bool:
    """
    Tạo GitHub Release.
    - Mặc định: Pre-release.
    - Nếu is_official=True: Latest Release.
    """
    if not _check_gh_cli():
        return False

    zip_filename = f"{APP_NAME}-{version_tag}.zip"
    full_zip_path = RELEASE_DIR / zip_filename

    if not full_zip_path.exists():
        logger.error(f"❌ Artifact not found for upload: {zip_filename}")
        return False

    release_type = "OFFICIAL (Latest)" if is_official else "PRE-RELEASE"
    logger.info(f"🚀 Publishing {release_type} {version_tag} to GitHub...")
    logger.info(f"   📦 Uploading artifact: {zip_filename}")

    artifacts = [str(full_zip_path)]
    
    # Tìm kiếm các artifact phụ (APK, MacOS, Alfred)
    optional_artifacts = [
        PROJECT_ROOT / "dist" / "apk" / "randomsutta.apk",
        PROJECT_ROOT / "dist" / "ios" / "randomsutta.ipa",
        PROJECT_ROOT / "dist" / "alfred" / "RandomSutta.alfredworkflow",
    ]
    
    macos_dir = PROJECT_ROOT / "dist" / "macos"
    if macos_dir.exists():
        for dmg in macos_dir.glob("*.dmg"):
            optional_artifacts.append(dmg)
            
    for art_path in optional_artifacts:
        if art_path.exists():
            artifacts.append(str(art_path))
            logger.info(f"   📦 Additional artifact: {art_path.name}")

    # Xây dựng lệnh gh
    cmd = [
        "gh", "release", "create", version_tag,
        "--title", f"Release {version_tag}",
        "--generate-notes"
    ] + artifacts

    # [LOGIC MỚI] Kiểm tra cờ official
    if is_official:
        cmd.append("--latest")
    else:
        cmd.append("--prerelease")

    try:
        subprocess.run(
            cmd,
            cwd=PROJECT_ROOT,
            check=True,
            text=True
        )
        logger.info(f"   ✅ Release {version_tag} published successfully!")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Failed to publish release: {e}")
        return False