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
    logger.info(f"📲 Updating AltStore Source for {version_tag}...")

    # Paths to write to
    target_paths = [PROJECT_ROOT / ALTSTORE_FILENAME]
    if DIST_WEB_DIR.exists():
        target_paths.append(DIST_WEB_DIR / ALTSTORE_FILENAME)
    
    # 1. Initialize or Load existing (Try root first as it's the source of truth)
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
            logger.info("   📂 Loaded existing AltStore source from root.")
        except Exception as e:
            logger.warning(f"   ⚠️ Could not load existing AltStore source: {e}")

    download_url = f"https://github.com/{GITHUB_REPO}/releases/download/{version_tag}/randomsutta.ipa"
    
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    new_version = {
        "version": version_tag.lstrip('v'),
        "date": date_str,
        "downloadURL": download_url,
        "localizedDescription": f"Release {version_tag}",
        "size": 0
    }

    # Find if the app already exists in the source
    app_entry = next((app for app in source["apps"] if app["bundleIdentifier"] == BUNDLE_ID), None)

    if app_entry:
        # Update existing app entry
        app_entry["versions"] = [v for v in app_entry["versions"] if v["version"] != new_version["version"]]
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
