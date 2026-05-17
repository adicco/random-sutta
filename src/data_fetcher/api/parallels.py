# Path: src/data_fetcher/api/parallels.py
import json
import urllib.request
import urllib.error
from ..fetcher_config import ParallelsConfig
from src.logging_config import setup_logging

logger = setup_logging("DataFetcher.Parallels")

__all__ = ["run_parallels_fetch"]

def run_parallels_fetch() -> None:
    logger.info("🚀 Starting Parallels Fetch...")
    
    url = ParallelsConfig.URL
    dest_dir = ParallelsConfig.DEST_DIR
    dest_file = ParallelsConfig.DEST_FILE
    
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        logger.info(f"   📥 Downloading from {url}")
        with urllib.request.urlopen(url, timeout=60) as response:
            if response.status != 200:
                logger.error(f"❌ HTTP Error: {response.status}")
                return
            
            data = json.loads(response.read().decode('utf-8'))
            with open(dest_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
        logger.info(f"   ✅ Saved to {dest_file}")
        logger.info("✨ Parallels Fetch completed.")
        
    except urllib.error.HTTPError as e:
        logger.error(f"❌ HTTP Error: {e.code}")
    except Exception as e:
        logger.error(f"❌ Error: {e}")
