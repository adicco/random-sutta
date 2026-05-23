# Path: src/release_system/logic/altstore_generator.py
import os
import json
import logging
import subprocess
from datetime import datetime
from pathlib import Path

from ..release_config import PROJECT_ROOT

logger = logging.getLogger("Release.AltStore")

# Constants
ALTSTORE_FILENAME = "altstore.json"
DIST_WEB_DIR = Path("dist/web")
GITHUB_REPO = "vjjda/random-sutta"
BUNDLE_ID = "com.randomsutta.app"
APP_NAME = "Random Sutta"
DEVELOPER_NAME = "Vijjo"
ICON_URL = f"https://vjjda.github.io/random-sutta/assets/icons/apple-touch-icon.png"

def sync_with_github() -> bool:
    """
    Fetches the latest release from GitHub and updates altstore.json.
    Useful for fixing broken links without a full local release process.
    """
    logger.info("📡 Syncing AltStore Source with GitHub Latest Release...")
    
    try:
        # Use gh CLI to get latest release info
        cmd = ["gh", "release", "view", "--json", "tagName,publishedAt"]
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        data = json.loads(result.stdout)
        
        latest_tag = data.get("tagName")
        # Format date from 2026-05-22T09:41:05Z to 2026-05-22
        pub_date = data.get("publishedAt", "").split('T')[0]
        
        if not latest_tag:
            logger.error("❌ Could not find latest release tag on GitHub.")
            return False
            
        logger.info(f"   ✨ Found Latest: {latest_tag} ({pub_date})")
        return update_altstore_source(latest_tag, pub_date)
        
    except Exception as e:
        logger.error(f"❌ Failed to sync with GitHub: {e}")
        return False

def update_altstore_source(version_tag: str, date_str: str = None) -> bool:
    """
    Updates or creates the AltStore source JSON file.
    Writes to both dist/web (for PWA) and project root (for GitHub Raw).
    """
    # 0. Prepare version string
    # IMPORTANT: The version in AltStore MUST match CFBundleShortVersionString in the IPA.
    # We use a clean version format (Year.MMDD.HHMM) if it looks like our tag format.
    # Otherwise we just strip 'v'.
    
    clean_version = version_tag.lstrip('v')
    if "-" in clean_version:
        # If it's 2026.05.23-02.18.36 -> 2026.0523.0218
        parts = clean_version.split("-")
        date_part = parts[0].replace(".", "") # 20260523
        time_part = parts[1].replace(".", "")[:4] # 0218
        # Try to reconstruct to a valid 3-part version: Year.MMDD.HHMM
        year = clean_version.split(".")[0]
        mmdd = clean_version.split(".")[1] + clean_version.split(".")[2].split("-")[0]
        hhmm = parts[1].replace(".", "")[:4]
        clean_version = f"{year}.{mmdd}.{hhmm}"

    logger.info(f"📲 Updating AltStore Source for {version_tag} (Internal version: {clean_version})...")

    # 1. Calculate Size of IPA if available
    ipa_path = PROJECT_ROOT / "dist/ios/randomsutta.ipa"
    ipa_size = 0
    if ipa_path.exists():
        ipa_size = ipa_path.stat().st_size
        logger.info(f"   📦 Found IPA: {ipa_size} bytes")
    else:
        logger.warning(f"   ⚠️ IPA not found at {ipa_path}. Size will be 0.")

    # Paths to write to
    target_paths = [PROJECT_ROOT / ALTSTORE_FILENAME]
    if DIST_WEB_DIR.exists():
        target_paths.append(DIST_WEB_DIR / ALTSTORE_FILENAME)
    
    # 2. Initialize or Load existing
    source = {
        "name": f"{APP_NAME} Source",
        "identifier": f"{BUNDLE_ID}.source",
        "apps": []
    }

    root_altstore = PROJECT_ROOT / ALTSTORE_FILENAME
    if root_altstore.exists():
        try:
            with open(root_altstore, 'r', encoding='utf-8') as f:
                source = json.load(f)
            logger.info("   📂 Loaded existing AltStore source.")
        except Exception as e:
            logger.warning(f"   ⚠️ Could not load existing AltStore source: {e}")

    download_url = f"https://github.com/{GITHUB_REPO}/releases/download/{version_tag}/randomsutta.ipa"
    
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    new_version = {
        "version": clean_version,
        "date": date_str,
        "downloadURL": download_url,
        "localizedDescription": f"Release {version_tag}",
        "size": ipa_size
    }

    # Find if the app already exists in the source
    app_entry = next((app for app in source["apps"] if app["bundleIdentifier"] == BUNDLE_ID), None)

    if app_entry:
        # Update existing app entry
        # Remove version if it already exists (same string)
        app_entry["versions"] = [v for v in app_entry["versions"] if v["version"] != clean_version]
        app_entry["versions"].insert(0, new_version)
        app_entry["iconURL"] = ICON_URL
    else:
        # Create new app entry
        app_entry = {
            "name": APP_NAME,
            "bundleIdentifier": BUNDLE_ID,
            "developerName": DEVELOPER_NAME,
            "subtitle": "Discover the Wisdom of the Buddha",
            "localizedDescription": "A lean, fast, and beautiful Sutta reader for PWA and Mobile.",
            "iconURL": ICON_URL,
            "versions": [new_version]
        }
        source["apps"].append(app_entry)

    try:
        for path in target_paths:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(source, f, indent=2, ensure_ascii=False)
            logger.info(f"   ✅ AltStore Source generated: {path}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to generate AltStore source: {e}")
        return False
