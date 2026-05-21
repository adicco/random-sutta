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
    Tạo file db_manifest.json chứa hash của TẤT CẢ các file .db để hỗ trợ Offline Update.
    """
    manifest_path = DIST_DB_DIR / "db_manifest.json"
    db_files = list(DIST_DB_DIR.glob("*.db"))
    
    if not db_files:
        logger.warning("⚠️ No .db files found in dist, skipping manifest generation.")
        return

    try:
        manifest_data = {
            "files": {},
            "total_size_bytes": 0,
            "generated_at_ts": 0
        }
        
        max_mtime = 0
        total_size = 0

        for db_file in db_files:
            file_hash = _calculate_file_hash(db_file)
            size = db_file.stat().st_size
            mtime = os.path.getmtime(db_file)
            
            manifest_data["files"][db_file.name] = {
                "hash": file_hash,
                "size_bytes": size
            }
            
            total_size += size
            if mtime > max_mtime:
                max_mtime = mtime
                
        manifest_data["total_size_bytes"] = total_size
        manifest_data["generated_at_ts"] = max_mtime
        
        # Tạo một hash duy nhất đại diện cho trạng thái của toàn bộ database
        manifest_string = json.dumps(manifest_data["files"], sort_keys=True)
        manifest_data["hash"] = hashlib.md5(manifest_string.encode()).hexdigest()
        
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)

        logger.info(f"   ✅ Manifest generated for {len(db_files)} DB files.")
        
    except Exception as e:
        logger.error(f"❌ Failed to generate DB manifest: {e}")
