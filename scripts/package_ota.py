#!/usr/bin/env python3
# Path: scripts/package_ota.py

import os
import json
import zipfile
import shutil
from datetime import datetime

# Configuration
DIST_WEB_DIR = "dist/web"
OUTPUT_DIR = "dist/ota"
MANIFEST_FILE = "native_version.json"
ZIP_FILE = "dist.zip"
BASE_URL = "https://hieucao.github.io/random-sutta"

def package_ota():
    print("🚀 Starting Lean OTA Packaging...")

    if not os.path.exists(DIST_WEB_DIR):
        print(f"❌ Error: {DIST_WEB_DIR} not found. Run 'npm run build' first.")
        return

    # 1. Prepare Output Directory
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR)

    # 2. Create Lean ZIP (Exclude assets/db/)
    zip_path = os.path.join(OUTPUT_DIR, ZIP_FILE)
    print(f"📦 Creating {ZIP_FILE} (excluding databases)...")
    
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
    print(f"✅ Created {ZIP_FILE} with {file_count} files ({zip_size:.2f} MB)")

    # 3. Generate native_version.json
    # We use a timestamp-based version for easy incrementing during dev, 
    # but in production, you might want to use package.json version + build number
    version = datetime.now().strftime("%Y.%m.%d-%H%M%S")
    
    manifest = {
        "version": version,
        "url": f"{BASE_URL}/{ZIP_FILE}",
        "timestamp": datetime.now().isoformat(),
        "notes": "Automated Lean OTA update"
    }

    manifest_path = os.path.join(OUTPUT_DIR, MANIFEST_FILE)
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"✅ Generated {MANIFEST_FILE} with version: {version}")
    print(f"📍 OTA files ready in: {OUTPUT_DIR}")
    print("\nNext steps:")
    print(f"1. Upload {ZIP_FILE} and {MANIFEST_FILE} to the root of your GitHub Pages repo.")
    print("2. Ensure any new .db files in dist/web/assets/db/ are also uploaded.")

if __name__ == "__main__":
    package_ota()
