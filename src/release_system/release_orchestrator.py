# Path: src/release_system/release_orchestrator.py
import logging
import sys

# [UPDATED] Import hằng số mới
from .release_config import CRITICAL_ASSETS
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
    sync_altstore: bool = False
) -> None:
    
    if is_official:
        logger.info("🌟 Mode: OFFICIAL RELEASE (Auto-enabling Publish & Git)")
        publish_gh = True
        update_altstore = True # Auto-enable for official

    if publish_gh: 
        enable_git = True

    version_tag = release_versioning.generate_version_tag()
    
    mode_label = "OFFICIAL (Latest)" if is_official else "PRE-RELEASE"
    if not publish_gh: mode_label = "LOCAL BUILD (No Publish)"
    if package_ota: mode_label = "OTA PACKAGE"
    if sync_altstore: mode_label = "ALTSTORE SYNC"

    logger.info(f"🚀 STARTING PROCESS: {version_tag} | Mode: {mode_label}")

    # [NEW] Auto-update package.json version to match current date
    # This ensures IPA internal version matches AltStore source.
    clean_version = release_versioning.get_clean_version()
    release_versioning.update_package_json(PROJECT_ROOT, clean_version)

    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # =========================================================
        # PHASE 3: PUBLISH
        # =========================================================
        
        # 1. OTA Packaging (New)
        if package_ota:
            if not ota_packager.package_lean_ota(version_tag):
                raise Exception("OTA packaging failed.")

        # 2. AltStore Source Sync/Generation
        if sync_altstore:
            from .logic import sync_with_github
            if not sync_with_github():
                logger.warning("⚠️ AltStore sync failed.")
        elif update_altstore:
            from .logic import update_altstore_source
            if not update_altstore_source(version_tag):
                logger.warning("⚠️ AltStore source generation failed, but continuing...")

        # 3. Create Artifact if requested or publishing
        if create_zip or publish_gh:
            if not artifact_packer.create_release_artifact(version_tag):
                raise Exception("Artifact creation failed.")

        if enable_git:
             if not git_automator.commit_source_changes(version_tag):
                logger.info("ℹ️  No source changes detected.")
            
             if publish_gh:
                if not git_automator.push_changes():
                    raise Exception("Git Push failed.")
                
                if not github_publisher.publish_release(version_tag, is_official):
                    raise Exception("GitHub Release failed.")
    
        logger.info(f"🛡️  Publish process finished.")

    except Exception as e:
        logger.error(f"❌ FAILED: {e}")
        sys.exit(1)