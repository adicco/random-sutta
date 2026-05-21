# Path: src/dict_builder/tools/db_packager.py
import gzip
import json
import hashlib
import logging
import shutil
from pathlib import Path

logger = logging.getLogger("dict_builder.packager")

# [CONFIG] Fixed datetime for deterministic zipping (2024-01-01 00:00:00)
FIXED_DATETIME = (2024, 1, 1, 0, 0, 0)

class DbPackager:
    @staticmethod
    def _calculate_file_hash(file_path: Path) -> str:
        """Calculate SHA-256 hash of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    @staticmethod
    def pack_database(source_db_path: Path, destination_dir: Path) -> bool:
        """
        Compresses the source .db file into a .db.gz in the destination directory.
        Also generates a deterministic .json manifest.
        
        Args:
            source_db_path: Path to the raw .db file (e.g. data/dpd/dpd_mini.db)
            destination_dir: Directory to save gz and manifest (e.g. web/assets/db/dictionaries)
        """
        if not source_db_path.exists():
            logger.error(f"❌ Source DB not found: {source_db_path}")
            return False

        if not destination_dir.exists():
            destination_dir.mkdir(parents=True, exist_ok=True)

        db_filename = source_db_path.name # dpd_mini.db
        gz_filename = f"{db_filename}.gz" # dpd_mini.db.gz
        manifest_filename = source_db_path.with_suffix(".json").name # dpd_mini.json
        
        target_gz_path = destination_dir / gz_filename
        target_manifest_path = destination_dir / manifest_filename
        
        logger.info(f"📦 Packaging {db_filename} -> {destination_dir}...")

        try:
            # 0. Copy Raw DB (for direct fetch support)
            target_db_path = destination_dir / db_filename
            shutil.copy2(source_db_path, target_db_path)
            logger.info(f"   ✅ Copied raw DB: {db_filename}")

            # 1. Create GZIP
            # mtime=0 for deterministic output (no timestamp inside the gzip)
            with open(source_db_path, "rb") as f_in:
                with gzip.GzipFile(target_gz_path, "wb", mtime=0) as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            # 2. Generate Hash & Manifest
            file_hash = DbPackager._calculate_file_hash(target_gz_path)
            
            manifest_data = {
                "hash": file_hash,
                "size": target_gz_path.stat().st_size,
                "generated_at": str(FIXED_DATETIME)
            }
            
            with open(target_manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest_data, f, indent=2)

            logger.info(f"   ✅ Created Gzip: {gz_filename} ({target_gz_path.stat().st_size / 1024 / 1024:.2f} MB)")
            logger.info(f"   ✅ Created Manifest: {manifest_filename} (Hash: {file_hash[:8]}...)")
                
            return True

        except Exception as e:
            logger.error(f"❌ Packaging failed: {e}")
            return False