# Path: src/sutta_processor/output/zip_generator.py
import logging
import zipfile
import os
import json
import hashlib
from pathlib import Path
from ..shared.app_config import DIST_DB_DIR

logger = logging.getLogger("SuttaProcessor.Output.ZipGen")

# [CONFIG] Thời gian cố định cho mọi file trong Zip (Nén đơn định)
FIXED_DATETIME = (2024, 1, 1, 0, 0, 0)

def _calculate_file_hash(file_path: Path) -> str:
    """Tính SHA-256 hash của một file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def create_db_bundle() -> None:
    """
    Nén toàn bộ folder assets/db thành db_bundle.zip với Deterministic Hashing.
    Và tạo file db_manifest.json chứa hash.
    """
    if not DIST_DB_DIR.exists():
        logger.warning("⚠️ DB Directory not found, skipping zip bundle.")
        return

    zip_path = DIST_DB_DIR / "db_bundle.zip"
    manifest_path = DIST_DB_DIR / "db_manifest.json"
    
    logger.info("📦 Creating deterministic DB bundle (db_bundle.zip)...")
    
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # Duyệt qua meta, content và index
            for subdir in ["meta", "content", "index"]:
                target_dir = DIST_DB_DIR / subdir
                if not target_dir.exists(): continue
                
                # Sort file để đảm bảo thứ tự nén luôn giống nhau (A-Z)
                files = sorted(list(target_dir.glob("*.json")))
                
                for file_path in files:
                    # Lưu vào zip với cấu trúc: meta/mn.json
                    arcname = f"{subdir}/{file_path.name}"
                    
                    with open(file_path, "rb") as f:
                        file_data = f.read()
                        
                    zinfo = zipfile.ZipInfo(filename=arcname, date_time=FIXED_DATETIME)
                    zinfo.external_attr = 0o644 << 16 
                    zinfo.compress_type = zipfile.ZIP_DEFLATED
                    
                    zf.writestr(zinfo, file_data)
        
        size_mb = zip_path.stat().st_size / (1024 * 1024)
        
        # Generate Hash & Manifest
        file_hash = _calculate_file_hash(zip_path)
        
        manifest_data = {
            "hash": file_hash,
            "size_bytes": zip_path.stat().st_size,
            "generated_at_ts": os.path.getmtime(zip_path)
        }
        
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)

        logger.info(f"   ✅ Bundle created: {size_mb:.2f} MB")
        logger.info(f"   ✅ Manifest generated: {file_hash[:12]}...")
        
    except Exception as e:
        logger.error(f"❌ Failed to create DB bundle: {e}")
