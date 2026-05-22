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
OUTPUT_DIR = "dist/ota"
MANIFEST_FILE = "native_version.json"
ZIP_FILE = "dist.zip"
BASE_URL = "https://hieucao.github.io/random-sutta"

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
        # 1. Prepare Output Directory
        if os.path.exists(OUTPUT_DIR):
            shutil.rmtree(OUTPUT_DIR)
        os.makedirs(OUTPUT_DIR)

        # 2. Create Lean ZIP (Exclude assets/db/)
        zip_path = os.path.join(OUTPUT_DIR, ZIP_FILE)
        logger.info(f"Creating {ZIP_FILE} (excluding databases)...")
        
        file_count = 0
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(DIST_WEB_DIR):
                # Skip the large database directory
                if "assets/db" in root:
                    continue
                    
                for file in files:
                    file_path = os.path.join(root, file)
                    # Calculate path relative to DIST_WEB_DIR for the zip entry
                    arcname = os.path.relpath(file_path, DIST_WEB_DIR)
                    zipf.write(file_path, arcname)
                    file_count += 1

        zip_size = os.path.getsize(zip_path) / (1024 * 1024)
        logger.info(f"✅ Created {ZIP_FILE} with {file_count} files ({zip_size:.2f} MB)")

        # 3. Generate native_version.json
        manifest = {
            "version": version_tag,
            "url": f"{BASE_URL}/{ZIP_FILE}",
            "timestamp": datetime.now().isoformat(),
            "notes": f"Automated Lean OTA update: {version_tag}"
        }

        manifest_path = os.path.join(OUTPUT_DIR, MANIFEST_FILE)
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)

        logger.info(f"✅ Generated {MANIFEST_FILE} with version: {version_tag}")
        logger.info(f"📍 OTA files ready in: {OUTPUT_DIR}")
        
        return True

    except Exception as e:
        logger.error(f"Failed to package OTA: {e}")
        return False
