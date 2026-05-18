# Path: src/data_fetcher/api/parallels.py
import json
import shutil
from ..fetcher_config import ParallelsConfig
from src.logging_config import setup_logging

logger = setup_logging("DataFetcher.Parallels")

__all__ = ["run_parallels_fetch"]

def run_parallels_fetch() -> None:
    logger.info("🚀 Starting Parallels Sync (Local)...")
    
    src_file = ParallelsConfig.SOURCE_FILE
    dest_file = ParallelsConfig.DEST_FILE
    
    if not src_file.exists():
        logger.error(f"❌ Source Parallels not found at {src_file}")
        return

    dest_file.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        logger.info(f"   🔄 Copying from {src_file}")
        shutil.copy2(src_file, dest_file)
        logger.info(f"   ✅ Saved to {dest_file}")
        logger.info("✨ Parallels Sync completed.")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
