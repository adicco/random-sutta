# Path: src/release_system/release_orchestrator.py
import logging
import sys

# [UPDATED] Import hằng số mới
from .release_config import CRITICAL_ASSETS, PROJECT_ROOT
from .logic import (
    release_versioning,
    asset_validator,
    git_automator,
    github_publisher,
    artifact_packer,
    ota_packager
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process(
    enable_git: bool = False, 
    publish_gh: bool = False,
    is_official: bool = False,
    deploy_web: bool = False,
    create_zip: bool = False,
    package_ota: bool = False,
    update_altstore: bool = False,
    sync_altstore: bool = False,
    bump_version: bool = True
) -> None:
    
    if is_official:
        logger.info("🌟 Mode: OFFICIAL RELEASE (Auto-enabling Publish & Git)")
        publish_gh = True
        update_altstore = True # Auto-enable for official

    if publish_gh: 
        enable_git = True

    # [UPDATED] Luôn dùng PROJECT_ROOT và truyền flag bump
    version_tag = release_versioning.generate_version_tag(PROJECT_ROOT, bump=bump_version)
    clean_version = release_versioning.get_clean_version(PROJECT_ROOT, bump=bump_version)

    mode_label = "OFFICIAL (Latest)" if is_official else "PRE-RELEASE"
    if not publish_gh: mode_label = "LOCAL BUILD (No Publish)"
    if package_ota: mode_label = "OTA PACKAGE"
    if sync_altstore: mode_label = "ALTSTORE SYNC"

    logger.info(f"🚀 STARTING PROCESS: {version_tag} | Mode: {mode_label}")

    # [NEW] Auto-update version number across ALL platforms
    # Chỉ thực hiện nếu bump_version=True, hoặc nếu phát hiện version hiện tại trong file đang sai
    if bump_version:
        release_versioning.update_package_json(PROJECT_ROOT, clean_version)
        release_versioning.update_xcode_version(PROJECT_ROOT, clean_version)
        release_versioning.update_android_version(PROJECT_ROOT, clean_version)
        release_versioning.update_tauri_version(PROJECT_ROOT, clean_version)
    else:
        logger.info(f"ℹ️  Using existing version: {clean_version}")

    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # =========================================================
        # PHASE 3: PUBLISH
        # =========================================================
        
        # 1. OTA Packaging
        if package_ota:
            if not ota_packager.package_lean_ota(version_tag):
                raise Exception("OTA packaging failed.")

        # ... (giữ nguyên logic ở giữa) ...

        if enable_git:
             if not git_automator.commit_source_changes(version_tag):
                logger.info("ℹ️  No source changes detected.")
            
             if publish_gh:
                if not git_automator.push_changes():
                    raise Exception("Git Push failed.")
                
                if not github_publisher.publish_release(version_tag, is_official):
                    raise Exception("GitHub Release failed.")
    
        # [REMOVED] Không tự động xóa lock file ở đây để Makefile có thể chạy tiếp các task khác
        logger.info(f"🛡️  Publish process finished.")

    except Exception as e:
        logger.error(f"❌ FAILED: {e}")
        sys.exit(1)