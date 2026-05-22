# Path: src/release_system/logic/altstore_generator.py
import os
import json
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("Release.AltStore")

# Constants
ALTSTORE_FILENAME = "altstore.json"
DIST_WEB_DIR = Path("dist/web")
GITHUB_REPO = "vjjda/random-sutta"
BUNDLE_ID = "com.randomsutta.app"
APP_NAME = "Random Sutta"
DEVELOPER_NAME = "Vijjo"
ICON_URL = f"https://vjjda.github.io/random-sutta/assets/icons/apple-touch-icon.png"

def update_altstore_source(version_tag: str) -> bool:
    """
    Updates or creates the AltStore source JSON file in dist/web.
    """
    logger.info(f"📲 Updating AltStore Source for {version_tag}...")

    if not DIST_WEB_DIR.exists():
        logger.error(f"Vite build directory not found: {DIST_WEB_DIR}")
        return False

    altstore_path = DIST_WEB_DIR / ALTSTORE_FILENAME
    
    # 1. Initialize or Load existing
    source = {
        "name": f"{APP_NAME} Source",
        "identifier": f"{BUNDLE_ID}.source",
        "apps": []
    }

    if altstore_path.exists():
        try:
            with open(altstore_path, 'r', encoding='utf-8') as f:
                source = json.load(f)
            logger.info("   📂 Loaded existing AltStore source.")
        except Exception as e:
            logger.warning(f"   ⚠️ Could not load existing AltStore source: {e}")

    download_url = f"https://github.com/{GITHUB_REPO}/releases/download/{version_tag}/randomsutta.ipa"
    
    new_version = {
        "version": version_tag.lstrip('v'),
        "date": datetime.now().strftime("%Y-%m-%d"),
        "downloadURL": download_url,
        "localizedDescription": f"Release {version_tag}",
        "size": 0
    }

    # Find if the app already exists in the source
    app_entry = next((app for app in source["apps"] if app["bundleIdentifier"] == BUNDLE_ID), None)

    if app_entry:
        # Update existing app entry
        # Remove version if it already exists (to update it)
        app_entry["versions"] = [v for v in app_entry["versions"] if v["version"] != new_version["version"]]
        # Add new version at the beginning (latest first)
        app_entry["versions"].insert(0, new_version)
        # Update other fields just in case
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
        with open(altstore_path, 'w', encoding='utf-8') as f:
            json.dump(source, f, indent=2, ensure_ascii=False)
        
        logger.info(f"   ✅ AltStore Source generated: {altstore_path}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to generate AltStore source: {e}")
        return False
