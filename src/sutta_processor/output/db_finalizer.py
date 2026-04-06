# Path: src/sutta_processor/output/db_finalizer.py
import logging
import json
import hashlib
import os
from pathlib import Path
from ..shared.app_config import DIST_DB_DIR

logger = logging.getLogger("SuttaProcessor.Output.DBFinalizer")

def _calculate_file_hash(file_path: Path) -> str:
    """Tính SHA-256 hash của một file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def generate_db_manifest() -> None:
    """
    Tạo file db_manifest.json chứa hash của sutta_data.db để hỗ trợ Offline Update.
    """
    db_path = DIST_DB_DIR / "sutta_data.db"
    manifest_path = DIST_DB_DIR / "db_manifest.json"
    
    if not db_path.exists():
        logger.warning(f"⚠️ {db_path.name} not found, skipping manifest generation.")
        return

    try:
        file_hash = _calculate_file_hash(db_path)
        
        manifest_data = {
            "hash": file_hash,
            "size_bytes": db_path.stat().st_size,
            "generated_at_ts": os.path.getmtime(db_path)
        }
        
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)

        logger.info(f"   ✅ Manifest generated for {db_path.name}: {file_hash[:12]}...")
        
    except Exception as e:
        logger.error(f"❌ Failed to generate DB manifest: {e}")
