# Path: src/release_system/logic/ota_packager.py
import os
import json
import zipfile
import shutil
import logging
from datetime import datetime
from typing import List

logger = logging.getLogger("Release.OTAPackager")

# Configuration (Could be moved to release_config.py later)
DIST_WEB_DIR = "dist/web"
MANIFEST_FILE = "native_version.json"
ZIP_FILE = "dist.zip"
BASE_URL = "https://vjjda.github.io/random-sutta"

def package_lean_ota(version_tag: str) -> bool:
    """
    Packages the web application into a 'Lean OTA' zip, 
    excluding the large database files.
    """
    logger.info("📦 Starting Lean OTA Packaging...")

    if not os.path.exists(DIST_WEB_DIR):
        logger.error(f"Vite build directory not found: {DIST_WEB_DIR}. Run build first.")
        return False

    try:
        # 1. Prepare ZIP (In DIST_WEB_DIR so it gets deployed)
        zip_path = os.path.join(DIST_WEB_DIR, ZIP_FILE)
        logger.info(f"Creating {ZIP_FILE} (excluding databases)...")
        
        file_count = 0
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(DIST_WEB_DIR):
                # Skip the large database directory and the zip itself if it exists
                if "assets/db" in root or ZIP_FILE in files:
                    continue
                    
                for file in files:
                    file_path = os.path.join(root, file)
                    # Calculate path relative to DIST_WEB_DIR for the zip entry
                    arcname = os.path.relpath(file_path, DIST_WEB_DIR)
                    zipf.write(file_path, arcname)
                    file_count += 1

        zip_size = os.path.getsize(zip_path) / (1024 * 1024)
        logger.info(f"✅ Created {ZIP_FILE} with {file_count} files ({zip_size:.2f} MB)")

        # 2. Generate native_version.json in DIST_WEB_DIR
        manifest = {
            "version": version_tag,
            "url": f"{BASE_URL}/{ZIP_FILE}",
            "timestamp": datetime.now().isoformat(),
            "notes": f"Automated Lean OTA update: {version_tag}"
        }

        manifest_path = os.path.join(DIST_WEB_DIR, MANIFEST_FILE)
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)

        logger.info(f"✅ Generated {MANIFEST_FILE} in {DIST_WEB_DIR}")
        
        return True

    except Exception as e:
        logger.error(f"Failed to package OTA: {e}")
        return False
